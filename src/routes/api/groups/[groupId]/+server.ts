import { json } from '@sveltejs/kit';
import { getGroupState, getGroupVersion } from '$lib/server/groups';
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
