// Shared shapes for group state, as served by the API and page loads.
// Timestamps are ISO strings (drizzle timestamp mode: 'string').

export type Member = {
	id: string;
	groupId: string;
	name: string;
	createdAt: string;
};

export type Item = {
	id: string;
	listId: string;
	title: string;
	note: string | null;
	checked: boolean;
	position: number;
	addedByMemberId: string | null;
	checkedByMemberId: string | null;
	createdAt: string;
	updatedAt: string;
};

export type TodoList = {
	id: string;
	groupId: string;
	name: string;
	position: number;
	createdAt: string;
	items: Item[];
};

export type GroupState = {
	version: number;
	group: { id: string; name: string };
	members: Member[];
	lists: TodoList[];
};
