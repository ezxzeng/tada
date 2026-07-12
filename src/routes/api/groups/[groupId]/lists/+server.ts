import { json } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { lists } from '$lib/server/db/schema';
import { bumpAndGetState, getGroupVersion } from '$lib/server/groups';
import { readJson } from '$lib/server/api';
import type { RequestHandler } from './$types';

const createListSchema = z.object({
	name: z.string().trim().min(1).max(80)
});

export const POST: RequestHandler = async ({ params, request }) => {
	const { groupId } = params;
	const body = await readJson(request, createListSchema);
	await getGroupVersion(groupId); // 404 if the group doesn't exist

	await db.insert(lists).values({ id: nanoid(12), groupId, name: body.name });

	return json(await bumpAndGetState(groupId), { status: 201 });
};
