<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import tadaDark from '$lib/assets/tada-horizontal-dark.svg';
	import tadaLight from '$lib/assets/tada-horizontal-light.svg';
	import { navigating, page } from '$app/state';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();

	// The home page has its own logo in the hero, so the top bar skips it there.
	const showLogo = $derived(page.route.id !== '/');
	const groupId = $derived(page.params.groupId);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if navigating.to}
	<div class="nav-progress" role="progressbar" aria-label="Loading"></div>
{/if}

<main class="shell">
	<div class="topbar">
		{#if showLogo}
			<a class="home" href="/" aria-label="tada — home">
				<img class="light-only" src={tadaLight} alt="" width="164" height="50" />
				<img class="dark-only" src={tadaDark} alt="" width="164" height="50" />
			</a>
		{/if}
		<div class="actions">
			{#if groupId}
				<ShareButton path="/g/{groupId}" />
			{/if}
			<ThemeToggle />
		</div>
	</div>

	{@render children()}

	<footer>
		<a href="https://github.com/ezxzeng/tada" target="_blank" rel="noopener noreferrer">View on GitHub</a>
	</footer>
</main>

<style>
	/* A navigation can wait seconds on a cold function and database; without this a
	   click shows nothing until it lands. The delay keeps fast navigations from flashing it. */
	.nav-progress {
		position: fixed;
		inset: 0 0 auto;
		z-index: 10;
		height: 3px;
		overflow: hidden;
		opacity: 0;
		animation: nav-progress-show 0s 150ms forwards;
	}

	.nav-progress::before {
		content: '';
		position: absolute;
		inset: 0;
		width: 40%;
		background: var(--accent);
		animation: nav-progress-slide 1s ease-in-out infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.nav-progress::before {
			width: 100%;
			animation: none;
		}
	}

	@keyframes nav-progress-show {
		to {
			opacity: 1;
		}
	}

	@keyframes nav-progress-slide {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(250%);
		}
	}

	.shell {
		max-width: 40rem;
		margin: 0 auto;
		padding: 1rem 1rem 4rem;
	}

	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		/* Reserves the row height even when the logo is hidden, so the actions
		   sit on the same line everywhere. */
		min-height: 2.375rem;
		margin-bottom: 1rem;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.home {
		display: flex;
		align-items: center;
	}

	/* No `display` here: the global .light-only/.dark-only rules own that. */
	.home img {
		width: 5rem;
		height: auto;
		vertical-align: bottom;
	}

	.home:hover img {
		opacity: 0.75;
	}

	footer {
		margin-top: 2rem;
		text-align: center;
		font-size: 0.85rem;
		color: var(--muted);
	}

	footer a:hover {
		color: var(--accent);
	}
</style>
