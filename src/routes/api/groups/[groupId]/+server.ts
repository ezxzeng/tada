import { json } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { groups } from '$lib/server/db/schema';
import { getGroupState, getGroupVersion } from '$lib/server/groups';
import { readJson } from '$lib/server/api';
import type { RequestHandler } from './$types';

const noStore = { 'cache-control': 'no-store' };

// Poll endpoint: ?since=<version> returns a tiny payload when nothing changed,
// otherwise the full group state.
export const GET: RequestHandler = async ({ params, url }) => {
	const version = await getGroupVersion(params.groupId);

	const sinceParam = url.searchParams.get('since');
	if (sinceParam !== null && Number(sinceParam) === version) {
		return json({ unchanged: true, version }, { headers: noStore });
	}

	return json(await getGroupState(params.groupId), { headers: noStore });
};

const renameGroupSchema = z.object({
	name: z.string().trim().min(1).max(80)
});

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { groupId } = params;
	const body = await readJson(request, renameGroupSchema);
	await getGroupVersion(groupId); // throws 404 if the group doesn't exist

	// The rename and the bump both hit the group's own row, which a
	// data-modifying CTE can't touch twice — set both columns in one UPDATE.
	await db
		.update(groups)
		.set({ name: body.name, version: sql`${groups.version} + 1` })
		.where(eq(groups.id, groupId));

	return json(await getGroupState(groupId));
};
