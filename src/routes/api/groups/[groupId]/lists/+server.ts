import { json } from '@sveltejs/kit';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { lists } from '$lib/server/db/schema';
import { getGroupState, getGroupVersion, runMutationAndGetState } from '$lib/server/groups';
import { readJson } from '$lib/server/api';
import type { RequestHandler } from './$types';

const createListSchema = z.object({
	name: z.string().trim().min(1).max(80)
});

const reorderSchema = z.object({
	ids: z.array(z.string()).min(1).max(500)
});

export const POST: RequestHandler = async ({ params, request }) => {
	const { groupId } = params;
	const body = await readJson(request, createListSchema);
	await getGroupVersion(groupId); // 404 if the group doesn't exist
	const [row] = await db
		.select({ max: sql<number | null>`max(${lists.position})` })
		.from(lists)
		.where(eq(lists.groupId, groupId));

	const id = nanoid(12);
	const insert = db
		.insert(lists)
		.values({ id, groupId, name: body.name, position: Number(row?.max ?? -1) + 1 })
		.returning({ id: lists.id });

	return json({ ...(await runMutationAndGetState(groupId, insert)), createdListId: id }, { status: 201 });
};

// Reorder every list in the group. A list added by another client mid-drag is
// appended in its existing relative order instead of receiving a duplicate position.
export const PATCH: RequestHandler = async ({ params, request }) => {
	const { groupId } = params;
	const body = await readJson(request, reorderSchema);
	await getGroupVersion(groupId);

	const rows = await db
		.select({ id: lists.id })
		.from(lists)
		.where(eq(lists.groupId, groupId))
		.orderBy(asc(lists.position), asc(lists.createdAt), asc(lists.id));
	const known = new Set(rows.map((row) => row.id));
	const seen = new Set<string>();
	const ordered: string[] = [];
	for (const id of body.ids) {
		if (!known.has(id) || seen.has(id)) continue;
		seen.add(id);
		ordered.push(id);
	}
	ordered.push(...rows.map((row) => row.id).filter((id) => !seen.has(id)));
	if (ordered.length === 0) return json(await getGroupState(groupId));

	const cases = sql.join(
		ordered.map((id, index) => sql`when ${lists.id} = ${id} then ${index}`),
		sql` `
	);
	const update = db
		.update(lists)
		.set({ position: sql`(case ${cases} end)::int` })
		.where(and(eq(lists.groupId, groupId), inArray(lists.id, ordered)))
		.returning({ id: lists.id });

	return json(await runMutationAndGetState(groupId, update));
};
