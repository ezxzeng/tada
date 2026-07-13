import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { readLimitedJson } from '$lib/server/api';
import {
	createWebhookIntegration,
	listWebhookIntegrations
} from '$lib/server/integrations';
import { WEBHOOK_ACTIONS } from '$lib/types';
import type { RequestHandler } from './$types';

const noStore = { 'cache-control': 'no-store' };

const createSchema = z.object({
	name: z.string().trim().min(1).max(80),
	listId: z.string().min(1).max(80),
	actions: z
		.array(z.enum(WEBHOOK_ACTIONS))
		.min(1)
		.max(WEBHOOK_ACTIONS.length)
		.refine((actions) => new Set(actions).size === actions.length, 'Actions must be unique')
});

export const GET: RequestHandler = async ({ params }) =>
	json(await listWebhookIntegrations(params.groupId), { headers: noStore });

export const POST: RequestHandler = async ({ params, request }) => {
	const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
	if (contentType !== 'application/json') throw error(415, 'Content-Type must be application/json');
	const parsed = createSchema.safeParse(await readLimitedJson(request));
	if (!parsed.success) throw error(400, parsed.error.issues[0]?.message ?? 'Invalid request');
	const body = parsed.data;
	const integration = await createWebhookIntegration({ groupId: params.groupId, ...body });
	return json(integration, { status: 201, headers: noStore });
};
