import { browser } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Checked only during the server render, so a mistyped list URL still gets a real 404.
// In the browser the layout's load data can predate lists added since (e.g. one just
// created), and the page already shows a notice for a list it can't find — so opening
// a list needs no server round trip.
export const load: PageLoad = async ({ parent, params }) => {
	if (browser) return;
	const { state } = await parent();
	if (!state.lists.some((list) => list.id === params.listId)) {
		error(404, 'List not found');
	}
};
