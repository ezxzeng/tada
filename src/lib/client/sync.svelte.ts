import { untrack } from 'svelte';
import { nanoid } from 'nanoid';
import type { GroupState, Item } from '$lib/types';

const POLL_INTERVAL_MS = 3000;

/**
 * Holds the live group state: polls the server every few seconds while the
 * tab is visible, applies mutations optimistically, and replaces local state
 * with the authoritative state returned by every mutation/poll response.
 */
export class GroupSync {
	state = $state() as GroupState;
	/** Last network attempt failed — changes may not be saved. */
	offline = $state(false);
	/** The group no longer exists on the server. */
	gone = $state(false);

	#polling = false;
	#mutating = 0;

	constructor(initial: GroupState) {
		this.state = initial;
	}

	get groupId(): string {
		return this.state.group.id;
	}

	/** Begin polling; returns a cleanup function (use inside $effect). */
	start(): () => void {
		const onWake = () => {
			if (document.visibilityState === 'visible') void this.poll();
		};
		document.addEventListener('visibilitychange', onWake);
		window.addEventListener('focus', onWake);
		window.addEventListener('online', onWake);
		const timer = setInterval(onWake, POLL_INTERVAL_MS);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onWake);
			window.removeEventListener('focus', onWake);
			window.removeEventListener('online', onWake);
		};
	}

	async poll(): Promise<void> {
		// Skip while a mutation is in flight so a poll response can't briefly
		// clobber an optimistic update.
		if (this.#polling || this.#mutating > 0) return;
		this.#polling = true;
		try {
			const res = await fetch(`/api/groups/${this.groupId}?since=${this.state.version}`);
			if (res.status === 404) {
				this.gone = true;
				return;
			}
			if (!res.ok) return;
			this.offline = false;
			const data = (await res.json()) as GroupState & { unchanged?: boolean };
			if (!data.unchanged && this.#mutating === 0) this.#apply(data);
		} catch {
			this.offline = true;
		} finally {
			this.#polling = false;
		}
	}

	#apply(next: GroupState, force = false): void {
		if (force || next.version >= this.state.version) this.state = next;
	}

	/** Apply freshly-loaded page data (client-side navigation), without registering reactive deps. */
	replaceFromLoad(next: GroupState): void {
		untrack(() => this.#apply(next, next.group.id !== this.state.group.id));
	}

	/** Refetch the full state and apply it even if versions match (used to roll back failed optimistic updates). */
	async #forceResync(): Promise<void> {
		try {
			const res = await fetch(`/api/groups/${this.groupId}`);
			if (res.status === 404) {
				this.gone = true;
				return;
			}
			if (!res.ok) return;
			this.#apply((await res.json()) as GroupState, true);
			this.offline = false;
		} catch {
			this.offline = true;
		}
	}

	async #mutate(method: string, path: string, body?: unknown): Promise<GroupState | null> {
		this.#mutating++;
		try {
			const res = await fetch(path, {
				method,
				headers: body === undefined ? undefined : { 'content-type': 'application/json' },
				body: body === undefined ? undefined : JSON.stringify(body)
			});
			if (!res.ok) {
				await this.#forceResync();
				return null;
			}
			const data = (await res.json()) as GroupState;
			this.offline = false;
			this.#apply(data);
			return data;
		} catch {
			this.offline = true;
			await this.#forceResync();
			return null;
		} finally {
			this.#mutating--;
		}
	}

	#api(path: string): string {
		return `/api/groups/${this.groupId}${path}`;
	}

	// ---- Group ----

	async renameGroup(name: string): Promise<void> {
		this.state.group.name = name;
		await this.#mutate('PATCH', this.#api(''), { name });
	}

	// ---- Lists ----

	async addList(name: string): Promise<string | null> {
		const before = new Set(this.state.lists.map((l) => l.id));
		const data = await this.#mutate('POST', this.#api('/lists'), { name });
		return data?.lists.find((l) => !before.has(l.id))?.id ?? null;
	}

	async renameList(listId: string, name: string): Promise<void> {
		const list = this.state.lists.find((l) => l.id === listId);
		if (list) list.name = name;
		await this.#mutate('PATCH', this.#api(`/lists/${listId}`), { name });
	}

	async deleteList(listId: string): Promise<void> {
		this.state.lists = this.state.lists.filter((l) => l.id !== listId);
		await this.#mutate('DELETE', this.#api(`/lists/${listId}`));
	}

	// ---- Items ----

	async addItem(listId: string, title: string, note: string): Promise<void> {
		const list = this.state.lists.find((l) => l.id === listId);
		const now = new Date().toISOString();
		list?.items.push({
			id: `optimistic-${nanoid(8)}`,
			listId,
			title,
			note: note || null,
			checked: false,
			position: list.items.reduce((max, i) => Math.max(max, i.position), -1) + 1,
			createdAt: now,
			updatedAt: now
		});
		await this.#mutate('POST', this.#api(`/lists/${listId}/items`), {
			title,
			note: note || undefined
		});
	}

	async toggleItem(item: Item): Promise<void> {
		const checked = !item.checked;
		item.checked = checked;
		await this.#mutate('PATCH', this.#api(`/lists/${item.listId}/items/${item.id}`), { checked });
	}

	async editItem(item: Item, title: string, note: string): Promise<void> {
		item.title = title;
		item.note = note || null;
		await this.#mutate('PATCH', this.#api(`/lists/${item.listId}/items/${item.id}`), {
			title,
			note: note || null
		});
	}

	async deleteItem(item: Item): Promise<void> {
		const list = this.state.lists.find((l) => l.id === item.listId);
		if (list) list.items = list.items.filter((i) => i.id !== item.id);
		await this.#mutate('DELETE', this.#api(`/lists/${item.listId}/items/${item.id}`));
	}

	/**
	 * Move the list's unchecked items into `orderedIds`. Checked items keep their
	 * relative order and sit after them, so positions stay unique across the list.
	 */
	async reorderItems(listId: string, orderedIds: string[]): Promise<void> {
		const list = this.state.lists.find((l) => l.id === listId);
		if (!list) return;

		const moving = new Set(orderedIds);
		const byId = new Map(list.items.map((i) => [i.id, i]));
		const ordered = [
			...orderedIds.map((id) => byId.get(id)).filter((i) => i !== undefined),
			...list.items.filter((i) => !moving.has(i.id))
		];
		ordered.forEach((item, index) => (item.position = index));
		list.items = ordered;

		await this.#mutate('PATCH', this.#api(`/lists/${listId}/items`), {
			ids: ordered.map((i) => i.id)
		});
	}

	async clearCompleted(listId: string): Promise<void> {
		const list = this.state.lists.find((l) => l.id === listId);
		if (list) list.items = list.items.filter((i) => !i.checked);
		await this.#mutate('DELETE', this.#api(`/lists/${listId}/items`));
	}
}
