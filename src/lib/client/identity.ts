import { browser } from '$app/environment';

// Identity is attribution, not auth: we just remember which member of each
// group this browser is, plus which groups it has visited.

const MEMBER_PREFIX = 'todo:member:';
const RECENTS_KEY = 'todo:recentGroups';

export function getStoredMemberId(groupId: string): string | null {
	if (!browser) return null;
	try {
		return localStorage.getItem(MEMBER_PREFIX + groupId);
	} catch {
		return null;
	}
}

export function storeMemberId(groupId: string, memberId: string): void {
	if (!browser) return;
	try {
		localStorage.setItem(MEMBER_PREFIX + groupId, memberId);
	} catch {
		// localStorage unavailable (private mode etc.) — identity just won't persist
	}
}

export type RecentGroup = { id: string; name: string; lastVisited: number };

export function getRecentGroups(): RecentGroup[] {
	if (!browser) return [];
	try {
		const parsed = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]');
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveRecents(recents: RecentGroup[]): void {
	try {
		localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
	} catch {
		// ignore
	}
}

export function rememberGroup(id: string, name: string): void {
	if (!browser) return;
	const rest = getRecentGroups().filter((g) => g.id !== id);
	saveRecents([{ id, name, lastVisited: Date.now() }, ...rest].slice(0, 20));
}

export function forgetGroup(id: string): void {
	if (!browser) return;
	saveRecents(getRecentGroups().filter((g) => g.id !== id));
}
