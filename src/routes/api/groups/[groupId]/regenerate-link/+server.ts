import { error, json } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '$lib/server/db';
import { groups } from '$lib/server/db/schema';
import { getGroupState } from '$lib/server/groups';
import type { RequestHandler } from './$types';

/**
 * Rotate the group ID, which is the share-link credential. The foreign key on
 * lists.groupId cascades the primary-key update, so all lists and items stay
 * intact while the former URL immediately stops resolving.
 */
export const POST: RequestHandler = async ({ params }) => {
	const groupId = params.groupId;
	const newGroupId = nanoid(16);
	const [rotated] = await db
		.update(groups)
		.set({ id: newGroupId, version: sql`${groups.version} + 1` })
		.where(eq(groups.id, groupId))
		.returning({ id: groups.id });

	if (!rotated) throw error(404, 'Group not found');

	return json(await getGroupState(newGroupId));
};
