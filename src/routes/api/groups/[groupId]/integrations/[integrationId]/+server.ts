import { json } from '@sveltejs/kit';
import { revokeWebhookIntegration } from '$lib/server/integrations';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params }) => {
	await revokeWebhookIntegration(params.groupId, params.integrationId);
	return json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
};
