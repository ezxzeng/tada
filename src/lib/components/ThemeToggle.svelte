<script lang="ts">
	import { theme } from '$lib/client/theme.svelte';

	const next = $derived(theme.current === 'dark' ? 'light' : 'dark');
</script>

<button
	class="toggle"
	onclick={() => theme.toggle()}
	aria-label="Switch to {next} mode"
	title="Switch to {next} mode"
>
	<svg class="light-only" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
		<path
			d="M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17m10-10 1.4-1.4"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2" />
	</svg>
	<svg class="dark-only" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
		<path
			d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linejoin="round"
		/>
	</svg>
</button>

<style>
	.toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		color: var(--muted);
		background: var(--card);
		border: 1px solid var(--border);
	}

	.toggle:hover {
		color: var(--accent);
		border-color: var(--accent);
	}
</style>
