<script lang="ts">
	import { setGroupSync } from '$lib/client/context.svelte';
	import { GroupSync } from '$lib/client/sync.svelte';
	import { rememberGroup } from '$lib/client/recents';

	let { data, children } = $props();

	// Deliberately captures only the initial load: later data flows in via replaceFromLoad below.
	// svelte-ignore state_referenced_locally
	const sync = setGroupSync(new GroupSync(data.state));

	// Poll while mounted; the returned cleanup stops it.
	$effect(() => sync.start());
	// Client-side navigations reload fresh data; fold it into the live state.
	$effect(() => sync.replaceFromLoad(data.state));
	$effect(() => {
		rememberGroup(sync.state.group.id, sync.state.group.name);
	});
</script>

<svelte:head>
	<title>{sync.state.group.name} · tada</title>
</svelte:head>

{#if sync.gone}
	<div class="banner">This group no longer exists.</div>
{:else if sync.offline}
	<div class="banner">Offline — changes may not be saved.</div>
{/if}

<header>
	<h1><a href="/g/{sync.groupId}">{sync.state.group.name}</a></h1>
</header>

{@render children()}

<style>
	.banner {
		position: sticky;
		top: 0.5rem;
		z-index: 5;
		padding: 0.5rem 0.9rem;
		border-radius: 10px;
		background: var(--danger);
		color: #fff;
		font-size: 0.9rem;
		font-weight: 600;
		text-align: center;
		margin-bottom: 0.75rem;
	}

	header {
		margin-bottom: 1.25rem;
	}

	h1 {
		font-size: 1.5rem;
		letter-spacing: -0.01em;
		overflow-wrap: anywhere;
	}

	h1 a {
		text-decoration: none;
	}
</style>
