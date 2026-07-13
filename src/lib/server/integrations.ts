import { error } from '@sveltejs/kit';
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from './db';
import { lists, webhookIntegrations } from './db/schema';
import { getGroupVersion } from './groups';
import type { CreatedWebhookIntegration, WebhookAction, WebhookIntegration } from '$lib/types';

const REQUESTS_PER_MINUTE = 60;

async function hashSecret(secret: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function secretsMatch(actualSecret: string, expectedHash: string): Promise<boolean> {
	const actualHash = await hashSecret(actualSecret);
	if (actualHash.length !== expectedHash.length) return false;
	let difference = 0;
	for (let index = 0; index < actualHash.length; index++) {
		difference |= actualHash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
	}
	return difference === 0;
}

export async function listWebhookIntegrations(groupId: string): Promise<WebhookIntegration[]> {
	await getGroupVersion(groupId);
	const rows = await db
		.select({
			id: webhookIntegrations.id,
			name: webhookIntegrations.name,
			listId: lists.id,
			listName: lists.name,
			actions: webhookIntegrations.actions,
			createdAt: webhookIntegrations.createdAt,
			lastUsedAt: webhookIntegrations.lastUsedAt
		})
		.from(webhookIntegrations)
		.innerJoin(lists, eq(webhookIntegrations.listId, lists.id))
		.where(and(eq(webhookIntegrations.groupId, groupId), isNull(webhookIntegrations.revokedAt)))
		.orderBy(desc(webhookIntegrations.createdAt));

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		list: { id: row.listId, name: row.listName },
		actions: row.actions,
		createdAt: row.createdAt,
		lastUsedAt: row.lastUsedAt
	}));
}

export async function createWebhookIntegration(input: {
	groupId: string;
	listId: string;
	name: string;
	actions: WebhookAction[];
}): Promise<CreatedWebhookIntegration> {
	const [list] = await db
		.select({ id: lists.id, name: lists.name })
		.from(lists)
		.where(and(eq(lists.id, input.listId), eq(lists.groupId, input.groupId)));
	if (!list) throw error(404, 'List not found');

	const id = `hook_${nanoid(16)}`;
	const secret = `tada_whsec_${nanoid(43)}`;
	const now = new Date().toISOString();
	const [created] = await db
		.insert(webhookIntegrations)
		.values({
			id,
			groupId: input.groupId,
			listId: input.listId,
			name: input.name,
			actions: input.actions,
			secretHash: await hashSecret(secret),
			rateWindowStartedAt: now
		})
		.returning({
			id: webhookIntegrations.id,
			name: webhookIntegrations.name,
			actions: webhookIntegrations.actions,
			createdAt: webhookIntegrations.createdAt,
			lastUsedAt: webhookIntegrations.lastUsedAt
		});

	return {
		...created,
		list,
		secret
	};
}

export async function revokeWebhookIntegration(groupId: string, integrationId: string): Promise<void> {
	await getGroupVersion(groupId);
	const [revoked] = await db
		.update(webhookIntegrations)
		.set({ revokedAt: new Date().toISOString() })
		.where(
			and(
				eq(webhookIntegrations.id, integrationId),
				eq(webhookIntegrations.groupId, groupId),
				isNull(webhookIntegrations.revokedAt)
			)
		)
		.returning({ id: webhookIntegrations.id });
	if (!revoked) throw error(404, 'Integration not found');
}

export type AuthenticatedWebhook = {
	id: string;
	groupId: string;
	listId: string;
	actions: WebhookAction[];
};

/** Authenticate first, then atomically consume one request from this credential's rate window. */
export async function authenticateWebhook(
	integrationId: string,
	authorization: string | null
): Promise<AuthenticatedWebhook> {
	const prefix = 'Bearer ';
	if (!authorization?.startsWith(prefix)) throw error(401, 'Invalid integration credential');
	const secret = authorization.slice(prefix.length);
	if (secret.length < 32 || secret.length > 200 || /\s/.test(secret)) {
		throw error(401, 'Invalid integration credential');
	}

	const [integration] = await db
		.select({
			id: webhookIntegrations.id,
			groupId: webhookIntegrations.groupId,
			listId: webhookIntegrations.listId,
			actions: webhookIntegrations.actions,
			secretHash: webhookIntegrations.secretHash
		})
		.from(webhookIntegrations)
		.where(and(eq(webhookIntegrations.id, integrationId), isNull(webhookIntegrations.revokedAt)));

	if (!integration || !(await secretsMatch(secret, integration.secretHash))) {
		throw error(401, 'Invalid integration credential');
	}

	const now = new Date();
	const nowIso = now.toISOString();
	const cutoff = new Date(now.getTime() - 60_000).toISOString();
	const windowExpired = lt(webhookIntegrations.rateWindowStartedAt, cutoff);
	const [allowed] = await db
		.update(webhookIntegrations)
		.set({
			lastUsedAt: nowIso,
			rateWindowStartedAt: sql`case when ${windowExpired} then ${nowIso} else ${webhookIntegrations.rateWindowStartedAt} end`,
			rateWindowCount: sql`case when ${windowExpired} then 1 else ${webhookIntegrations.rateWindowCount} + 1 end`
		})
		.where(
			and(
				eq(webhookIntegrations.id, integration.id),
				isNull(webhookIntegrations.revokedAt),
				or(windowExpired, lt(webhookIntegrations.rateWindowCount, REQUESTS_PER_MINUTE))
			)
		)
		.returning({ id: webhookIntegrations.id });

	if (!allowed) throw error(429, 'Integration rate limit exceeded');
	return integration;
}
