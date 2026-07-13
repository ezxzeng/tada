import adapter from '@sveltejs/adapter-vercel';

// Hash of the inline theme script in src/app.html (the one that sets data-theme before first
// paint). CSP blocks all inline scripts by default, so we vouch for this exact one by hash.
// If you edit that script — even its whitespace — recompute this:
//   node -e 'const c=require("crypto"),f=require("fs");const m=f.readFileSync("src/app.html","utf8").match(/<script>([\s\S]*?)<\/script>/);console.log("sha256-"+c.createHash("sha256").update(m[1]).digest("base64"))'
const themeScriptHash = 'sha256-oq1bfYSOqwBBqgeDOtit1Hv6G79J4KuqgT/BRzwkncg=';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) =>
			filename.split(/[/\\]/).includes('node_modules') ? undefined : true
	},
	kit: {
		adapter: adapter(),
		csp: {
			directives: {
				'default-src': ['self'],
				// SvelteKit augments script-src with hashes/nonces for the scripts it generates;
				// we add the app.html theme script by hash.
				'script-src': ['self', themeScriptHash],
				// External stylesheets are same-origin. 'unsafe-inline' covers Svelte's inline
				// <style> elements; style-src-attr covers inline style="" attributes (e.g. the
				// drag-sort transform), which a nonce on style-src would otherwise disable.
				'style-src': ['self', 'unsafe-inline'],
				'style-src-attr': ['unsafe-inline'],
				'img-src': ['self', 'data:'],
				'font-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				// Clickjacking protection — forbid the app from being embedded anywhere.
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
