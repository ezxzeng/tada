<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="corner">
	<ThemeToggle />
</div>

<main class="shell">
	{@render children()}
</main>

<style>
	.shell {
		max-width: 40rem;
		margin: 0 auto;
		padding: 1rem 1rem 4rem;
	}

	.corner {
		position: fixed;
		top: 0.75rem;
		right: 0.75rem;
		z-index: 10;
	}
</style>
