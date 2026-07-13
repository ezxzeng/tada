import { relations } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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

export const groupsRelations = relations(groups, ({ many }) => ({
	lists: many(lists)
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
	group: one(groups, { fields: [lists.groupId], references: [groups.id] }),
	items: many(items)
}));

export const itemsRelations = relations(items, ({ one }) => ({
	list: one(lists, { fields: [items.listId], references: [lists.id] })
}));
