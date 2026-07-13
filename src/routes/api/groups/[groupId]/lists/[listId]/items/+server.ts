import { json } from '@sveltejs/kit';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';
import { assertListInGroup, getGroupState, runMutationAndGetState } from '$lib/server/groups';
import { readJson } from '$lib/server/api';
import type { RequestHandler } from './$types';

const addItemSchema = z.object({
	title: z.string().trim().min(1).max(200),
	note: z.string().trim().max(300).optional()
});

const reorderSchema = z.object({
	ids: z.array(z.string()).min(1).max(500)
});

export const POST: RequestHandler = async ({ params, request }) => {
	const { groupId, listId } = params;
	const body = await readJson(request, addItemSchema);
	await assertListInGroup(groupId, listId);

	const [row] = await db
		.select({ max: sql<number | null>`max(${items.position})` })
		.from(items)
		.where(eq(items.listId, listId));

	const insert = db
		.insert(items)
		.values({
			id: nanoid(12),
			listId,
			title: body.title,
			note: body.note || null,
			position: Number(row?.max ?? -1) + 1
		})
		.returning({ id: items.id });

	return json(await runMutationAndGetState(groupId, insert), { status: 201 });
};

// Reorder: `ids` is every item in the list, in its new order. Ids that no
// longer exist (deleted by someone else mid-drag) are ignored.
export const PATCH: RequestHandler = async ({ params, request }) => {
	const { groupId, listId } = params;
	const body = await readJson(request, reorderSchema);
	await assertListInGroup(groupId, listId);

	const rows = await db.select({ id: items.id }).from(items).where(eq(items.listId, listId));
	const known = new Set(rows.map((r) => r.id));
	const ordered = body.ids.filter((id) => known.has(id));
	if (ordered.length === 0) return json(await getGroupState(groupId));

	// The neon-http driver has no interactive transactions, so write all the
	// new positions with a single CASE update.
	const cases = sql.join(
		ordered.map((id, i) => sql`when ${items.id} = ${id} then ${i}`),
		sql` `
	);
	const update = db
		.update(items)
		// The cast is required: bound parameters arrive untyped, so postgres can't
		// infer the CASE result type on its own.
		.set({ position: sql`(case ${cases} end)::int` })
		.where(and(eq(items.listId, listId), inArray(items.id, ordered)))
		.returning({ id: items.id });

	return json(await runMutationAndGetState(groupId, update));
};

// Clear completed: deletes every checked item in the list.
export const DELETE: RequestHandler = async ({ params }) => {
	const { groupId, listId } = params;
	await assertListInGroup(groupId, listId);

	// With nothing checked the CTE returns no rows and the bump is skipped.
	const del = db
		.delete(items)
		.where(and(eq(items.listId, listId), eq(items.checked, true)))
		.returning({ id: items.id });

	return json(await runMutationAndGetState(groupId, del));
};
