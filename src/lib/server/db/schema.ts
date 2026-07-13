import { relations } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { WebhookAction } from '../../types';

const createdAt = () =>
	timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow();

export const groups = pgTable('groups', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	// Incremented on every mutation in the group; clients poll against it.
	version: integer('version').notNull().default(0),
	createdAt: createdAt()
});

export const lists = pgTable(
	'lists',
	{
		id: text('id').primaryKey(),
		groupId: text('group_id')
			.notNull()
			.references(() => groups.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		name: text('name').notNull(),
		position: integer('position').notNull().default(0),
		createdAt: createdAt()
	},
	(t) => [index('lists_group_id_idx').on(t.groupId)]
);

export const items = pgTable(
	'items',
	{
		id: text('id').primaryKey(),
		listId: text('list_id')
			.notNull()
			.references(() => lists.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		note: text('note'),
		checked: boolean('checked').notNull().default(false),
		position: integer('position').notNull().default(0),
		createdAt: createdAt(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow()
	},
	(t) => [index('items_list_id_idx').on(t.listId)]
);

export const webhookIntegrations = pgTable(
	'webhook_integrations',
	{
		// Public selector used in the endpoint URL. It is not a credential.
		id: text('id').primaryKey(),
		groupId: text('group_id')
			.notNull()
			.references(() => groups.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		listId: text('list_id')
			.notNull()
			.references(() => lists.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		actions: jsonb('actions').$type<WebhookAction[]>().notNull(),
		// Secrets are random high-entropy values, so a fast cryptographic hash is
		// appropriate and lets us verify them without retaining the plaintext.
		secretHash: text('secret_hash').notNull(),
		createdAt: createdAt(),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'string' }),
		revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
		rateWindowStartedAt: timestamp('rate_window_started_at', {
			withTimezone: true,
			mode: 'string'
		})
			.notNull()
			.defaultNow(),
		rateWindowCount: integer('rate_window_count').notNull().default(0)
	},
	(t) => [
		index('webhook_integrations_group_id_idx').on(t.groupId),
		index('webhook_integrations_list_id_idx').on(t.listId),
		uniqueIndex('webhook_integrations_secret_hash_idx').on(t.secretHash)
	]
);

export const groupsRelations = relations(groups, ({ many }) => ({
	lists: many(lists),
	webhookIntegrations: many(webhookIntegrations)
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
	group: one(groups, { fields: [lists.groupId], references: [groups.id] }),
	items: many(items),
	webhookIntegrations: many(webhookIntegrations)
}));

export const itemsRelations = relations(items, ({ one }) => ({
	list: one(lists, { fields: [items.listId], references: [lists.id] })
}));

export const webhookIntegrationsRelations = relations(webhookIntegrations, ({ one }) => ({
	group: one(groups, { fields: [webhookIntegrations.groupId], references: [groups.id] }),
	list: one(lists, { fields: [webhookIntegrations.listId], references: [lists.id] })
}));
