import { and, eq, sql, type SQLWrapper } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from './db';
import { groups, items, lists } from './db/schema';
import type { GroupState } from '$lib/types';

export async function getGroupVersion(groupId: string): Promise<number> {
	const [row] = await db
		.select({ version: groups.version })
		.from(groups)
		.where(eq(groups.id, groupId));
	if (!row) throw error(404, 'Group not found');
	return row.version;
}

export async function getGroupState(groupId: string): Promise<GroupState> {
	const group = await db.query.groups.findFirst({
		where: eq(groups.id, groupId),
		with: {
			lists: {
				orderBy: (l, { asc }) => [asc(l.position), asc(l.createdAt), asc(l.id)],
				with: {
					items: { orderBy: (i, { asc }) => [asc(i.position), asc(i.createdAt), asc(i.id)] }
				}
			}
		}
	});
	if (!group) throw error(404, 'Group not found');
	return {
		version: group.version,
		group: { id: group.id, name: group.name },
		lists: group.lists
	};
}

/**
 * Run one or more data-modifying queries and bump the group version in a
 * single statement (the queries become data-modifying CTEs of the UPDATE on
 * groups). neon-http has no transactions, so as separate statements a failure
 * between the write and the bump would commit a change pollers never see.
 * Each query must have `.returning()` — the bump is conditioned on at least
 * one CTE having produced a row, so no-op mutations don't bump.
 */
export async function runMutation(
	groupId: string,
	...mutations: [SQLWrapper, ...SQLWrapper[]]
): Promise<void> {
	// No explicit parens: the sql template wraps interpolated query builders in
	// parentheses already, which is exactly the CTE body syntax.
	const ctes = sql.join(
		mutations.map((m, i) => sql`${sql.raw(`m${i}`)} as ${m}`),
		sql`, `
	);
	const touched = sql.join(
		mutations.map((_, i) => sql`exists (select 1 from ${sql.raw(`m${i}`)})`),
		sql` or `
	);
	await db.execute(
		sql`with ${ctes} update ${groups} set version = version + 1 where ${groups.id} = ${groupId} and (${touched})`
	);
}

/** Finish a mutation: run it, bump the group version, return the fresh full state. */
export async function runMutationAndGetState(
	groupId: string,
	...mutations: [SQLWrapper, ...SQLWrapper[]]
): Promise<GroupState> {
	await runMutation(groupId, ...mutations);
	return getGroupState(groupId);
}

export async function assertListInGroup(groupId: string, listId: string): Promise<void> {
	const [row] = await db
		.select({ id: lists.id })
		.from(lists)
		.where(and(eq(lists.id, listId), eq(lists.groupId, groupId)));
	if (!row) throw error(404, 'List not found');
}

export async function assertItemInList(
	groupId: string,
	listId: string,
	itemId: string
): Promise<void> {
	const [row] = await db
		.select({ id: items.id })
		.from(items)
		.innerJoin(lists, eq(items.listId, lists.id))
		.where(and(eq(items.id, itemId), eq(items.listId, listId), eq(lists.groupId, groupId)));
	if (!row) throw error(404, 'Item not found');
}
