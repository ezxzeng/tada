import { browser } from '$app/environment';

// Groups are anonymous: the only thing this browser remembers is which groups
// it has visited, so it can offer them as shortcuts on the home page.

const RECENTS_KEY = 'todo:recentGroups';

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
