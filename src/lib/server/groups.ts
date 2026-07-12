import { and, eq, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from './db';
import { groups, items, lists, members } from './db/schema';
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
			members: { orderBy: (m, { asc }) => [asc(m.createdAt), asc(m.id)] },
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
		members: group.members,
		lists: group.lists
	};
}

export async function bumpVersion(groupId: string): Promise<void> {
	await db
		.update(groups)
		.set({ version: sql`${groups.version} + 1` })
		.where(eq(groups.id, groupId));
}

/** Finish a mutation: bump the group version and return the fresh full state. */
export async function bumpAndGetState(groupId: string): Promise<GroupState> {
	await bumpVersion(groupId);
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

export async function assertMemberInGroup(groupId: string, memberId: string): Promise<void> {
	const [row] = await db
		.select({ id: members.id })
		.from(members)
		.where(and(eq(members.id, memberId), eq(members.groupId, groupId)));
	if (!row) throw error(400, 'Unknown member');
}
