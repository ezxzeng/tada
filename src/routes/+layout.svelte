<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<main class="shell">
	{@render children()}
</main>

<style>
	.shell {
		max-width: 40rem;
		margin: 0 auto;
		padding: 1rem 1rem 4rem;
	}
</style>
