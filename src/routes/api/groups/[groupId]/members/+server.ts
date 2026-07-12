import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { members } from '$lib/server/db/schema';
import { bumpAndGetState, getGroupVersion } from '$lib/server/groups';
import { readJson } from '$lib/server/api';
import type { RequestHandler } from './$types';

const joinSchema = z.object({
	name: z.string().trim().min(1).max(40)
});

// Join a group: creates a member, or claims the existing member with the same
// name (names are unique per group, so this is idempotent).
export const POST: RequestHandler = async ({ params, request }) => {
	const { groupId } = params;
	const body = await readJson(request, joinSchema);
	await getGroupVersion(groupId); // 404 if the group doesn't exist

	const [inserted] = await db
		.insert(members)
		.values({ id: nanoid(12), groupId, name: body.name })
		.onConflictDoNothing()
		.returning({ id: members.id });

	let memberId = inserted?.id;
	if (!memberId) {
		const [existing] = await db
			.select({ id: members.id })
			.from(members)
			.where(and(eq(members.groupId, groupId), eq(members.name, body.name)));
		memberId = existing.id;
	}

	const state = await bumpAndGetState(groupId);
	return json({ ...state, memberId }, { status: 201 });
};
