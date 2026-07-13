import { error } from '@sveltejs/kit';
import { and, eq, inArray, type SQLWrapper } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from './db';
import { items, lists } from './db/schema';
import { runMutation } from './groups';
import type { TodoList, WebhookAction } from '$lib/types';

export type WebhookInvocation = {
	action: WebhookAction;
	items: string[];
	note?: string;
};

type WebhookResult = Record<string, unknown> & {
	ok: true;
	action: WebhookAction;
	list: { name: string };
	speech: string;
};

async function getIntegrationList(groupId: string, listId: string): Promise<TodoList> {
	const list = await db.query.lists.findFirst({
		where: and(eq(lists.id, listId), eq(lists.groupId, groupId)),
		with: {
			items: { orderBy: (i, { asc }) => [asc(i.position), asc(i.createdAt), asc(i.id)] }
		}
	});
	if (!list) throw error(404, 'Integration list not found');
	return list;
}

/** "Milk" · "Milk and eggs" · "Milk, eggs and bread" */
function spoken(titles: string[]): string {
	if (titles.length <= 1) return titles.join('');
	return `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`;
}

function status(list: TodoList): WebhookResult {
	const todo = list.items.filter((item) => !item.checked);
	const speech =
		list.items.length === 0
			? `${list.name} is empty.`
			: todo.length === 0
				? `Everything on ${list.name} is done.`
				: `${list.name} has ${todo.length} ${todo.length === 1 ? 'item' : 'items'} to get: ${spoken(todo.map((item) => item.title))}.`;

	return {
		ok: true,
		action: 'status',
		list: { name: list.name },
		remaining: todo.length,
		items: list.items.map((item) => ({
			title: item.title,
			note: item.note,
			checked: item.checked
		})),
		speech
	};
}

/** Execute an already authenticated and authorized integration command. */
export async function invokeWebhook(
	groupId: string,
	listId: string,
	request: WebhookInvocation
): Promise<WebhookResult> {
	const list = await getIntegrationList(groupId, listId);
	if (request.action === 'status') return status(list);

	const matching = (title: string) =>
		list.items.filter((item) => item.title.toLowerCase() === title.toLowerCase());
	const now = new Date().toISOString();
	const mutations: SQLWrapper[] = [];
	const speech: string[] = [];
	let result: Record<string, unknown>;

	if (request.action === 'add') {
		const added: string[] = [];
		const restored: string[] = [];
		const already: string[] = [];
		const rows: (typeof items.$inferInsert)[] = [];
		const restoreIds: string[] = [];
		let position = list.items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
		const seen = new Set<string>();

		for (const title of request.items) {
			const key = title.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			const existing = matching(title);
			const active = existing.find((item) => !item.checked);
			if (active) {
				already.push(active.title);
			} else if (existing.length > 0) {
				restoreIds.push(existing[0].id);
				restored.push(existing[0].title);
			} else {
				rows.push({
					id: nanoid(12),
					listId: list.id,
					title,
					note: request.note || null,
					position: position++
				});
				added.push(title);
			}
		}

		if (rows.length > 0) mutations.push(db.insert(items).values(rows).returning({ id: items.id }));
		if (restoreIds.length > 0) {
			mutations.push(
				db
					.update(items)
					.set({ checked: false, updatedAt: now })
					.where(inArray(items.id, restoreIds))
					.returning({ id: items.id })
			);
		}

		if (added.length > 0) speech.push(`Added ${spoken(added)} to ${list.name}.`);
		if (restored.length > 0) speech.push(`Put ${spoken(restored)} back on ${list.name}.`);
		if (already.length > 0) {
			speech.push(`${spoken(already)} ${already.length === 1 ? 'is' : 'are'} already on ${list.name}.`);
		}
		result = { added, restored, already };
	} else if (request.action === 'remove') {
		const removed: string[] = [];
		const notFound: string[] = [];
		const removeIds: string[] = [];
		for (const title of request.items) {
			const matches = matching(title);
			if (matches.length === 0) {
				notFound.push(title);
				continue;
			}
			removed.push(matches[0].title);
			removeIds.push(...matches.map((item) => item.id));
		}
		if (removeIds.length > 0) {
			mutations.push(db.delete(items).where(inArray(items.id, removeIds)).returning({ id: items.id }));
		}
		if (removed.length > 0) speech.push(`Removed ${spoken(removed)} from ${list.name}.`);
		if (notFound.length > 0) speech.push(`${spoken(notFound)} wasn't on ${list.name}.`);
		result = { removed, notFound };
	} else {
		const target = request.action === 'complete';
		const affected: string[] = [];
		const notFound: string[] = [];
		const flipIds: string[] = [];
		for (const title of request.items) {
			const matches = matching(title);
			if (matches.length === 0) {
				notFound.push(title);
				continue;
			}
			affected.push(matches[0].title);
			flipIds.push(...matches.filter((item) => item.checked !== target).map((item) => item.id));
		}
		if (flipIds.length > 0) {
			mutations.push(
				db
					.update(items)
					.set({ checked: target, updatedAt: now })
					.where(inArray(items.id, flipIds))
					.returning({ id: items.id })
			);
		}
		if (affected.length > 0) {
			speech.push(
				target
					? `Checked off ${spoken(affected)} on ${list.name}.`
					: `Unchecked ${spoken(affected)} on ${list.name}.`
			);
		}
		if (notFound.length > 0) speech.push(`Couldn't find ${spoken(notFound)} on ${list.name}.`);
		result = { [target ? 'completed' : 'uncompleted']: affected, notFound };
	}

	const [first, ...rest] = mutations;
	if (first) await runMutation(groupId, first, ...rest);

	return {
		ok: true,
		action: request.action,
		list: { name: list.name },
		...result,
		speech: speech.join(' ')
	};
}
