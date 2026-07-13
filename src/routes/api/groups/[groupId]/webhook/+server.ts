import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// The former endpoint reused the group share ID as an integration credential,
// which gave a leaked automation URL full access to the group API. Keep a
// machine-readable tombstone during migration, but never authenticate it.
const gone = () =>
	json(
		{
			ok: false,
			error: 'This webhook endpoint has been retired. Create a scoped integration in Group settings.'
		},
		{ status: 410, headers: { 'cache-control': 'no-store' } }
	);

export const GET: RequestHandler = gone;
export const POST: RequestHandler = gone;
