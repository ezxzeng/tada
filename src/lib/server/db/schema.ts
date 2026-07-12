import { relations } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

const createdAt = () =>
	timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow();

export const groups = pgTable('groups', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	// Incremented on every mutation in the group; clients poll against it.
	version: integer('version').notNull().default(0),
	createdAt: createdAt()
});

export const members = pgTable(
	'members',
	{
		id: text('id').primaryKey(),
		groupId: text('group_id')
			.notNull()
			.references(() => groups.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('members_group_id_name_unique').on(t.groupId, t.name)]
);

export const lists = pgTable(
	'lists',
	{
		id: text('id').primaryKey(),
		groupId: text('group_id')
			.notNull()
			.references(() => groups.id, { onDelete: 'cascade' }),
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
		addedByMemberId: text('added_by_member_id').references(() => members.id, {
			onDelete: 'set null'
		}),
		checkedByMemberId: text('checked_by_member_id').references(() => members.id, {
			onDelete: 'set null'
		}),
		createdAt: createdAt(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow()
	},
	(t) => [index('items_list_id_idx').on(t.listId)]
);

export const groupsRelations = relations(groups, ({ many }) => ({
	members: many(members),
	lists: many(lists)
}));

export const membersRelations = relations(members, ({ one }) => ({
	group: one(groups, { fields: [members.groupId], references: [groups.id] })
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
	group: one(groups, { fields: [lists.groupId], references: [groups.id] }),
	items: many(items)
}));

export const itemsRelations = relations(items, ({ one }) => ({
	list: one(lists, { fields: [items.listId], references: [lists.id] })
}));
