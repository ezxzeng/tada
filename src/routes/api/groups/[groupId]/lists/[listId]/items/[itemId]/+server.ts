import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';
import { assertItemInList, getGroupState, runMutationAndGetState } from '$lib/server/groups';
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

	const update: Partial<typeof items.$inferInsert> = {};
	if (body.title !== undefined) update.title = body.title;
	if (body.note !== undefined) update.note = body.note || null;
	if (body.checked !== undefined) update.checked = body.checked;
	if (Object.keys(update).length === 0) return json(await getGroupState(groupId));

	update.updatedAt = new Date().toISOString();

	return json(
		await runMutationAndGetState(
			groupId,
			db.update(items).set(update).where(eq(items.id, itemId)).returning({ id: items.id })
		)
	);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const { groupId, listId, itemId } = params;
	await assertItemInList(groupId, listId, itemId);

	return json(
		await runMutationAndGetState(
			groupId,
			db.delete(items).where(eq(items.id, itemId)).returning({ id: items.id })
		)
	);
};
