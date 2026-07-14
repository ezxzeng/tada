import { json } from '@sveltejs/kit';

type RateLimitRule = {
	name: string;
	limit: number;
	windowMs: number;
};

type RateLimitEntry = {
	count: number;
	resetAt: number;
};

const entries = new Map<string, RateLimitEntry>();
const MAX_ENTRIES = 10_000;
let nextCleanupAt = 0;

const GROUP_CREATION: RateLimitRule = { name: 'group-create', limit: 10, windowMs: 60 * 60_000 };
const WEBHOOKS: RateLimitRule = { name: 'webhook', limit: 120, windowMs: 60_000 };
const API_READS: RateLimitRule = { name: 'api-read', limit: 300, windowMs: 60_000 };
const API_MUTATIONS: RateLimitRule = { name: 'api-mutation', limit: 120, windowMs: 60_000 };
const GROUP_PAGES: RateLimitRule = { name: 'group-page', limit: 120, windowMs: 60_000 };

function ruleFor(method: string, pathname: string): RateLimitRule | null {
	if (method === 'POST' && pathname === '/api/groups') return GROUP_CREATION;
	if (pathname.startsWith('/api/hooks/')) return WEBHOOKS;
	if (pathname.startsWith('/api/groups/')) {
		return method === 'GET' || method === 'HEAD' ? API_READS : API_MUTATIONS;
	}
	if ((method === 'GET' || method === 'HEAD') && pathname.startsWith('/g/')) return GROUP_PAGES;
	return null;
}

function cleanup(now: number): void {
	if (now < nextCleanupAt && entries.size < MAX_ENTRIES) return;
	for (const [key, entry] of entries) {
		if (entry.resetAt <= now) entries.delete(key);
	}
	// Keep memory bounded even under a flood of unique client addresses.
	while (entries.size >= MAX_ENTRIES) {
		const oldestKey = entries.keys().next().value as string | undefined;
		if (oldestKey === undefined) break;
		entries.delete(oldestKey);
	}
	nextCleanupAt = now + 60_000;
}

/**
 * Apply a cheap, instance-local limit before public requests reach the database.
 * Webhooks also have a durable per-credential limit in the database.
 */
export function checkRateLimit(
	method: string,
	pathname: string,
	clientAddress: string,
	now = Date.now()
): Response | null {
	const rule = ruleFor(method, pathname);
	if (!rule) return null;

	cleanup(now);
	const key = `${rule.name}:${clientAddress}`;
	let entry = entries.get(key);
	if (!entry || entry.resetAt <= now) {
		entry = { count: 0, resetAt: now + rule.windowMs };
		entries.set(key, entry);
	}
	entry.count += 1;

	const remaining = Math.max(0, rule.limit - entry.count);
	const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
	const headers = {
		'RateLimit-Limit': String(rule.limit),
		'RateLimit-Remaining': String(remaining),
		'RateLimit-Reset': String(resetSeconds),
		'Cache-Control': 'no-store'
	};

	if (entry.count <= rule.limit) return null;
	return json(
		{ message: 'Too many requests. Please try again later.' },
		{ status: 429, headers: { ...headers, 'Retry-After': String(resetSeconds) } }
	);
}
