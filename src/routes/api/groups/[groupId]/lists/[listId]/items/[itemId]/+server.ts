import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';
import {
	assertItemInList,
	assertMemberInGroup,
	bumpAndGetState
} from '$lib/server/groups';
import { readJson } from '$lib/server/api';
import type { RequestHandler } from './$types';

const editItemSchema = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	note: z.string().trim().max(300).nullable().optional(),
	checked: z.boolean().optional(),
	memberId: z.string().min(1).max(40).optional()
});

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { groupId, listId, itemId } = params;
	const body = await readJson(request, editItemSchema);
	await assertItemInList(groupId, listId, itemId);
	if (body.memberId) await assertMemberInGroup(groupId, body.memberId);

	const update: Partial<typeof items.$inferInsert> = {
		updatedAt: new Date().toISOString()
	};
	if (body.title !== undefined) update.title = body.title;
	if (body.note !== undefined) update.note = body.note || null;
	if (body.checked !== undefined) {
		update.checked = body.checked;
		// Attribute who checked it off; clear attribution when unchecking.
		update.checkedByMemberId = body.checked ? (body.memberId ?? null) : null;
	}

	await db.update(items).set(update).where(eq(items.id, itemId));

	return json(await bumpAndGetState(groupId));
};

export const DELETE: RequestHandler = async ({ params }) => {
	const { groupId, listId, itemId } = params;
	await assertItemInList(groupId, listId, itemId);

	await db.delete(items).where(eq(items.id, itemId));

	return json(await bumpAndGetState(groupId));
};
