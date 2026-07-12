// Shared shapes for group state, as served by the API and page loads.
// Timestamps are ISO strings (drizzle timestamp mode: 'string').

export type Item = {
	id: string;
	listId: string;
	title: string;
	note: string | null;
	checked: boolean;
	position: number;
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
	lists: TodoList[];
};
