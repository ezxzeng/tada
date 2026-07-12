import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';
import {
	assertListInGroup,
	assertMemberInGroup,
	bumpAndGetState
} from '$lib/server/groups';
import { readJson } from '$lib/server/api';
import type { RequestHandler } from './$types';

const addItemSchema = z.object({
	title: z.string().trim().min(1).max(200),
	note: z.string().trim().max(300).optional(),
	memberId: z.string().min(1).max(40).optional()
});

export const POST: RequestHandler = async ({ params, request }) => {
	const { groupId, listId } = params;
	const body = await readJson(request, addItemSchema);
	await assertListInGroup(groupId, listId);
	if (body.memberId) await assertMemberInGroup(groupId, body.memberId);

	await db.insert(items).values({
		id: nanoid(12),
		listId,
		title: body.title,
		note: body.note || null,
		addedByMemberId: body.memberId ?? null
	});

	return json(await bumpAndGetState(groupId), { status: 201 });
};

// Clear completed: deletes every checked item in the list.
export const DELETE: RequestHandler = async ({ params }) => {
	const { groupId, listId } = params;
	await assertListInGroup(groupId, listId);

	await db.delete(items).where(and(eq(items.listId, listId), eq(items.checked, true)));

	return json(await bumpAndGetState(groupId));
};
