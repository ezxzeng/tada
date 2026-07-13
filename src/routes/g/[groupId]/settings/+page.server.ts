import { listWebhookIntegrations } from '$lib/server/integrations';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => ({
	integrations: await listWebhookIntegrations(params.groupId)
});
