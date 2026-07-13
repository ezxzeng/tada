import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';
import { assertItemInList, bumpAndGetState } from '$lib/server/groups';
import { readJson } from '$lib/server/api';
import type { RequestHandler } from './$types';

const editItemSchema = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	note: z.string().trim().max(300).nullable().optional(),
	checked: z.boolean().optional()
});

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { groupId, listId, itemId } = params;
	const body = await readJson(request, editItemSchema);
	await assertItemInList(groupId, listId, itemId);

	const update: Partial<typeof items.$inferInsert> = {
		updatedAt: new Date().toISOString()
	};
	if (body.title !== undefined) update.title = body.title;
	if (body.note !== undefined) update.note = body.note || null;
	if (body.checked !== undefined) update.checked = body.checked;

	await db.update(items).set(update).where(eq(items.id, itemId));

	return json(await bumpAndGetState(groupId));
};

export const DELETE: RequestHandler = async ({ params }) => {
	const { groupId, listId, itemId } = params;
	await assertItemInList(groupId, listId, itemId);

	await db.delete(items).where(eq(items.id, itemId));

	return json(await bumpAndGetState(groupId));
};
