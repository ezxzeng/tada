import type { Handle } from '@sveltejs/kit';

// Security headers applied to every response. The Content-Security-Policy is configured
// separately in svelte.config.js (kit.csp) so SvelteKit can hash/nonce its own inline scripts.
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// A group's URL is its only credential, so never leak it to other origins via the
	// Referer header when a user follows a link out of the app or loads a cross-origin resource.
	response.headers.set('Referrer-Policy', 'same-origin');

	// Don't let the browser second-guess our declared Content-Type (an XSS vector).
	response.headers.set('X-Content-Type-Options', 'nosniff');

	// Clickjacking protection. CSP frame-ancestors 'none' is the modern equivalent, but this
	// also covers older browsers and prerendered pages (where frame-ancestors is delivered via
	// a <meta> tag and therefore ignored).
	response.headers.set('X-Frame-Options', 'DENY');

	return response;
};
