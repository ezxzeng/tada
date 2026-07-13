<script lang="ts">
	import { page } from '$app/state';
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

	// The group root is the only place the name isn't a back-link, so rename lives there.
	const atRoot = $derived(page.params.listId === undefined);

	let renaming = $state(false);
	let renameValue = $state('');

	// Don't leave a half-finished rename form behind when navigating into a list.
	$effect(() => {
		if (!atRoot) renaming = false;
	});

	function startRename() {
		renameValue = sync.state.group.name;
		renaming = true;
	}

	function saveRename(event: SubmitEvent) {
		event.preventDefault();
		const name = renameValue.trim();
		if (!name) return;
		void sync.renameGroup(name);
		renaming = false;
	}
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
	{#if atRoot && renaming}
		<form class="rename" onsubmit={saveRename}>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				bind:value={renameValue}
				maxlength="80"
				aria-label="Group name"
				autofocus
			/>
			<button type="button" class="btn-quiet" onclick={() => (renaming = false)}>Cancel</button>
			<button class="btn" disabled={!renameValue.trim()}>Save</button>
		</form>
	{:else if atRoot}
		<h1>
			<button class="title" onclick={startRename} aria-label="Rename group">
				{sync.state.group.name}
			</button>
		</h1>
	{:else}
		<h1><a href="/g/{sync.groupId}">{sync.state.group.name}</a></h1>
	{/if}
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

	/* Looks like the plain heading; clicking it renames the group. */
	.title {
		font: inherit;
		letter-spacing: inherit;
		text-align: left;
		color: inherit;
		padding: 0;
	}

	.title:hover {
		text-decoration: underline;
		text-decoration-style: dotted;
	}

	.rename {
		display: flex;
		gap: 0.5rem;
	}
</style>
