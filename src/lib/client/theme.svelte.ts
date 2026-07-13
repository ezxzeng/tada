import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'tada:theme';

class ThemeStore {
	// The inline script in app.html resolves the stored/system theme before first paint,
	// so the attribute is the source of truth by the time we hydrate.
	current = $state<Theme>(
		browser && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
	);

	toggle() {
		this.current = this.current === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = this.current;
		try {
			localStorage.setItem(THEME_KEY, this.current);
		} catch {
			// Private browsing — the choice just won't survive a reload.
		}
	}
}

export const theme = new ThemeStore();
