import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { lists } from '$lib/server/db/schema';
import { assertListInGroup, bumpAndGetState } from '$lib/server/groups';
import { readJson } from '$lib/server/api';
import type { RequestHandler } from './$types';

const renameListSchema = z.object({
	name: z.string().trim().min(1).max(80)
});

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { groupId, listId } = params;
	const body = await readJson(request, renameListSchema);
	await assertListInGroup(groupId, listId);

	await db.update(lists).set({ name: body.name }).where(eq(lists.id, listId));

	return json(await bumpAndGetState(groupId));
};

export const DELETE: RequestHandler = async ({ params }) => {
	const { groupId, listId } = params;
	await assertListInGroup(groupId, listId);

	await db.delete(lists).where(eq(lists.id, listId)); // items cascade

	return json(await bumpAndGetState(groupId));
};
