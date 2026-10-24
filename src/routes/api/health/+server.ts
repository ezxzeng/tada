import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

const noStore = { 'cache-control': 'no-store' };

// Health check: 200 when the database answers, 503 when it doesn't. The home page also
// calls it to wake a cold function and a suspended Neon compute before the first click
// needs them. Don't point a frequent uptime monitor at it: that keeps Neon awake around
// the clock and uses up the free plan's compute hours.
export const GET: RequestHandler = async () => {
	try {
		await db.execute(sql`select 1`);
	} catch (err) {
		console.error('Health check failed: database unreachable', err);
		return json({ status: 'unavailable' }, { status: 503, headers: noStore });
	}
	return json({ status: 'ok' }, { headers: noStore });
};
