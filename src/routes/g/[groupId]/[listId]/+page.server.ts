import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { state } = await parent();
	if (!state.lists.some((list) => list.id === params.listId)) {
		error(404, 'List not found');
	}
	return {};
};
