import { getGroupState } from '$lib/server/groups';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => ({
	state: await getGroupState(params.groupId)
});
