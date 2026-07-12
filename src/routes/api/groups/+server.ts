import { json } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { groups, lists } from '$lib/server/db/schema';
import { getGroupState } from '$lib/server/groups';
import { readJson } from '$lib/server/api';
import type { RequestHandler } from './$types';

const createGroupSchema = z.object({
	groupName: z.string().trim().min(1).max(80),
	listName: z.string().trim().min(1).max(80)
});

export const POST: RequestHandler = async ({ request }) => {
	const body = await readJson(request, createGroupSchema);

	// 16-char nanoid (~95 bits of entropy): the group URL is the credential.
	const groupId = nanoid(16);
	const listId = nanoid(12);

	await db.insert(groups).values({ id: groupId, name: body.groupName });
	await db.insert(lists).values({ id: listId, groupId, name: body.listName });

	return json(await getGroupState(groupId), { status: 201 });
};
