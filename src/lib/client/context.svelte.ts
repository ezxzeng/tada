import { getContext, setContext } from 'svelte';
import { GroupSync } from './sync.svelte';

const KEY = Symbol('group-sync');

/** The live group state, created by the group layout and consumed by its pages. */
export function setGroupSync(sync: GroupSync): GroupSync {
	return setContext(KEY, sync);
}

export function getGroupSync(): GroupSync {
	return getContext<GroupSync>(KEY);
}
