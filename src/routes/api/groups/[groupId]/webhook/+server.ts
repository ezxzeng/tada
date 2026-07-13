import { error, json } from '@sveltejs/kit';
import { inArray, type SQLWrapper } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';
import { getGroupState, runMutation } from '$lib/server/groups';
import type { GroupState, TodoList } from '$lib/types';
import type { RequestHandler } from './$types';

// One permissive endpoint for external integrations — voice assistants, Home
// Assistant, IoT buttons, fridge cameras. Callers pass an action and item
// title(s) via query string, JSON body, or form body, whichever they can
// produce; lists are addressed by name. Responses are small summaries with a
// `speech` sentence ready for TTS, not the full group state the app's own API
// returns. See the Integrations section of the README for examples.

// Browser-based callers (e.g. a custom button page on a wall tablet) need
// CORS. The group id in the URL is the only credential, same as the app.
const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET, POST, OPTIONS',
	'access-control-allow-headers': 'content-type'
};

const ACTION_ALIASES: Record<string, string> = {
	check: 'complete',
	done: 'complete',
	uncheck: 'uncomplete',
	need: 'uncomplete',
	delete: 'remove',
	get: 'status'
};

const requestSchema = z.object({
	action: z.enum(['add', 'complete', 'uncomplete', 'remove', 'status']),
	titles: z.array(z.string().trim().min(1).max(200)).max(100),
	list: z.string().trim().min(1).max(80).optional(),
	note: z.string().trim().max(300).optional()
});

type WebhookRequest = z.infer<typeof requestSchema>;

/**
 * Merge params from the query string and the body (JSON or form), body
 * winning. Item titles come from `item` (single) or `items` (repeatable /
 * array), collected across both sources.
 */
async function readRequest(request: Request, url: URL): Promise<WebhookRequest> {
	const raw: Record<string, unknown> = {};
	const titles: unknown[] = [];

	for (const key of ['action', 'list', 'note']) {
		const value = url.searchParams.get(key);
		if (value !== null) raw[key] = value;
	}
	titles.push(...url.searchParams.getAll('item'), ...url.searchParams.getAll('items'));

	const type = request.headers.get('content-type') ?? '';
	if (type.includes('json')) {
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			throw error(400, 'Invalid JSON body');
		}
		if (typeof body === 'object' && body !== null) {
			const source = body as Record<string, unknown>;
			for (const key of ['action', 'list', 'note']) {
				if (source[key] !== undefined) raw[key] = source[key];
			}
			titles.push(...[source.item, source.items].flat());
		}
	} else if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
		const form = await request.formData();
		for (const key of ['action', 'list', 'note']) {
			const value = form.get(key);
			if (typeof value === 'string') raw[key] = value;
		}
		titles.push(...form.getAll('item'), ...form.getAll('items'));
	}

	const action = typeof raw.action === 'string' ? raw.action.trim().toLowerCase() : 'add';
	const result = requestSchema.safeParse({
		action: ACTION_ALIASES[action] ?? action,
		titles: titles.filter((t) => typeof t === 'string' && t.trim() !== ''),
		list: raw.list === '' ? undefined : raw.list,
		note: raw.note === '' ? undefined : raw.note
	});
	if (!result.success) throw error(400, result.error.issues[0]?.message ?? 'Invalid request');
	if (result.data.action !== 'status' && result.data.titles.length === 0) {
		throw error(400, 'Missing "item" — pass the item title in the query string or body');
	}
	return result.data;
}

/** Match a list by id or name (case-insensitive); no `ref` means the group's first list. */
function resolveList(state: GroupState, ref: string | undefined): TodoList {
	if (ref === undefined) {
		const first = state.lists[0];
		if (!first) throw error(404, 'This group has no lists yet — open the app and create one first');
		return first;
	}
	const needle = ref.toLowerCase();
	const match =
		state.lists.find((l) => l.id === ref) ??
		state.lists.find((l) => l.name.toLowerCase() === needle);
	if (!match) {
		const names = state.lists.map((l) => `"${l.name}"`).join(', ');
		throw error(404, `No list called "${ref}" in this group — it has ${names}`);
	}
	return match;
}

/** "Milk" · "Milk and eggs" · "Milk, eggs and bread" */
function spoken(titles: string[]): string {
	if (titles.length <= 1) return titles.join('');
	return `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`;
}

function status(list: TodoList): Response {
	const todo = list.items.filter((i) => !i.checked);
	const speech =
		list.items.length === 0
			? `${list.name} is empty.`
			: todo.length === 0
				? `Everything on ${list.name} is done.`
				: `${list.name} has ${todo.length} ${todo.length === 1 ? 'item' : 'items'} to get: ${spoken(todo.map((i) => i.title))}.`;
	return json(
		{
			ok: true,
			action: 'status',
			list: { id: list.id, name: list.name },
			remaining: todo.length,
			items: list.items.map((i) => ({ id: i.id, title: i.title, note: i.note, checked: i.checked })),
			speech
		},
		{ headers: { ...CORS, 'cache-control': 'no-store' } }
	);
}

export const GET: RequestHandler = async ({ params, url }) => {
	const state = await getGroupState(params.groupId);
	return status(resolveList(state, url.searchParams.get('list')?.trim() || undefined));
};

export const OPTIONS: RequestHandler = async () => new Response(null, { headers: CORS });

export const POST: RequestHandler = async ({ params, request, url }) => {
	const req = await readRequest(request, url);
	const state = await getGroupState(params.groupId); // 404s for unknown groups
	const list = resolveList(state, req.list);

	if (req.action === 'status') return status(list);

	// Titles match case-insensitively so callers needn't reproduce exact casing.
	const matching = (title: string) =>
		list.items.filter((i) => i.title.toLowerCase() === title.toLowerCase());

	const now = new Date().toISOString();
	// Collected unexecuted, then run together with the version bump in one
	// atomic statement at the end.
	const mutations: SQLWrapper[] = [];
	let body: Record<string, unknown>;
	const speech: string[] = [];

	if (req.action === 'add') {
		// Grocery semantics: re-adding something unchecked is a no-op, re-adding
		// something already checked off puts it back on the todo side.
		const added: string[] = [];
		const restored: string[] = [];
		const already: string[] = [];
		const rows: (typeof items.$inferInsert)[] = [];
		const restoreIds: string[] = [];
		let position = list.items.reduce((max, i) => Math.max(max, i.position), -1) + 1;
		const seen = new Set<string>();

		for (const title of req.titles) {
			if (seen.has(title.toLowerCase())) continue;
			seen.add(title.toLowerCase());
			const existing = matching(title);
			const active = existing.find((i) => !i.checked);
			if (active) {
				already.push(active.title);
			} else if (existing.length > 0) {
				restoreIds.push(existing[0].id);
				restored.push(existing[0].title);
			} else {
				rows.push({ id: nanoid(12), listId: list.id, title, note: req.note || null, position: position++ });
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
		body = { added, restored, already };
	} else if (req.action === 'remove') {
		const removed: string[] = [];
		const notFound: string[] = [];
		const removeIds: string[] = [];
		for (const title of req.titles) {
			const matches = matching(title);
			if (matches.length === 0) {
				notFound.push(title);
				continue;
			}
			removed.push(matches[0].title);
			removeIds.push(...matches.map((i) => i.id));
		}
		if (removeIds.length > 0) {
			mutations.push(db.delete(items).where(inArray(items.id, removeIds)).returning({ id: items.id }));
		}

		if (removed.length > 0) speech.push(`Removed ${spoken(removed)} from ${list.name}.`);
		if (notFound.length > 0) speech.push(`${spoken(notFound)} wasn't on ${list.name}.`);
		body = { removed, notFound };
	} else {
		// complete / uncomplete. Items already in the requested state count as
		// success so a button pressed twice doesn't report a failure.
		const target = req.action === 'complete';
		const affected: string[] = [];
		const notFound: string[] = [];
		const flipIds: string[] = [];
		for (const title of req.titles) {
			const matches = matching(title);
			if (matches.length === 0) {
				notFound.push(title);
				continue;
			}
			affected.push(matches[0].title);
			flipIds.push(...matches.filter((i) => i.checked !== target).map((i) => i.id));
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
		body = { [target ? 'completed' : 'uncompleted']: affected, notFound };
	}

	const [first, ...rest] = mutations;
	if (first) await runMutation(params.groupId, first, ...rest);

	return json(
		{ ok: true, action: req.action, list: { id: list.id, name: list.name }, ...body, speech: speech.join(' ') },
		{ headers: CORS }
	);
};
