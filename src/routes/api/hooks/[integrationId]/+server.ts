import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { readLimitedJson } from '$lib/server/api';
import { authenticateWebhook } from '$lib/server/integrations';
import { invokeWebhook } from '$lib/server/webhooks';
import { WEBHOOK_ACTIONS } from '$lib/types';
import type { RequestHandler } from './$types';

const requestSchema = z
	.object({
		action: z.enum(WEBHOOK_ACTIONS),
		items: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
		note: z.string().trim().max(300).optional()
	})
	.strict();

export const POST: RequestHandler = async ({ params, request }) => {
	const integration = await authenticateWebhook(
		params.integrationId,
		request.headers.get('authorization')
	);

	const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
	if (contentType !== 'application/json') throw error(415, 'Content-Type must be application/json');

	const parsed = requestSchema.safeParse(await readLimitedJson(request));
	if (!parsed.success) throw error(400, parsed.error.issues[0]?.message ?? 'Invalid request');
	if (!integration.actions.includes(parsed.data.action)) throw error(403, 'Action is not allowed');
	if (parsed.data.action !== 'status' && parsed.data.items.length === 0) {
		throw error(400, 'At least one item is required');
	}

	return json(
		await invokeWebhook(integration.groupId, integration.listId, parsed.data),
		{ headers: { 'cache-control': 'no-store' } }
	);
};
