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

export const WEBHOOK_ACTIONS = ['add', 'complete', 'uncomplete', 'remove', 'status'] as const;

export type WebhookAction = (typeof WEBHOOK_ACTIONS)[number];

export type WebhookIntegration = {
	id: string;
	name: string;
	list: { id: string; name: string };
	actions: WebhookAction[];
	createdAt: string;
	lastUsedAt: string | null;
};

export type CreatedWebhookIntegration = WebhookIntegration & {
	/** Returned once when the integration is created; never persisted in plaintext. */
	secret: string;
};
