import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
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

	// One statement so a failure can't leave a group without its first list
	// (neon-http has no transactions).
	const insertGroup = db.insert(groups).values({ id: groupId, name: body.groupName });
	const insertList = db.insert(lists).values({ id: listId, groupId, name: body.listName });
	// The template parenthesizes interpolated builders — right for the CTE body,
	// wrong for the primary statement, so inline the latter via getSQL().
	await db.execute(sql`with g as ${insertGroup} ${insertList.getSQL()}`);

	return json(await getGroupState(groupId), { status: 201 });
};
