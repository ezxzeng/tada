import { getContext, setContext } from 'svelte';
import { GroupSync } from './sync.svelte';
import { getStoredMemberId, storeMemberId } from './identity';
import type { GroupState, Member } from '$lib/types';

const KEY = Symbol('group-context');

/**
 * Per-group page context: the live sync store plus "who am I" identity.
 * Created by the group layout, consumed by the group-home and list pages.
 */
export class GroupContext {
	sync: GroupSync;
	memberId = $state<string | null>(null);
	/** Identity has been loaded from localStorage (client only). */
	ready = $state(false);

	constructor(initial: GroupState) {
		this.sync = new GroupSync(initial);
	}

	get me(): Member | null {
		return this.sync.memberById(this.memberId) ?? null;
	}

	/** Show the "who are you?" picker once identity is loaded and unknown. */
	get showPicker(): boolean {
		return this.ready && !this.me;
	}

	loadIdentity(): void {
		this.memberId = getStoredMemberId(this.sync.groupId);
		this.ready = true;
	}

	identify(memberId: string): void {
		storeMemberId(this.sync.groupId, memberId);
		this.memberId = memberId;
	}

	async joinAs(name: string): Promise<boolean> {
		const id = await this.sync.join(name);
		if (id) this.identify(id);
		return id !== null;
	}
}

export function setGroupContext(ctx: GroupContext): GroupContext {
	return setContext(KEY, ctx);
}

export function getGroupContext(): GroupContext {
	return getContext<GroupContext>(KEY);
}
