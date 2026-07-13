import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// SvelteKit config (adapter, compilerOptions, CSP, …) lives in svelte.config.js.
export default defineConfig({
	plugins: [sveltekit()]
});
