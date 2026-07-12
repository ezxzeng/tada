<script lang="ts">
	import { GroupContext, setGroupContext } from '$lib/client/context.svelte';
	import { rememberGroup } from '$lib/client/identity';
	import MemberPicker from '$lib/components/MemberPicker.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';

	let { data, children } = $props();

	// Deliberately captures only the initial load: later data flows in via replaceFromLoad below.
	// svelte-ignore state_referenced_locally
	const ctx = setGroupContext(new GroupContext(data.state));
	const sync = ctx.sync;

	// Poll while mounted; the returned cleanup stops it.
	$effect(() => sync.start());
	// Client-side navigations reload fresh data; fold it into the live state.
	$effect(() => sync.replaceFromLoad(data.state));
	$effect(() => {
		rememberGroup(sync.state.group.id, sync.state.group.name);
	});
	$effect(() => {
		ctx.loadIdentity();
	});
</script>

<svelte:head>
	<title>{sync.state.group.name} · todo-lst</title>
</svelte:head>

{#if sync.gone}
	<div class="banner">This group no longer exists.</div>
{:else if sync.offline}
	<div class="banner">Offline — changes may not be saved.</div>
{/if}

<header>
	<a class="home muted" href="/">todo-lst</a>
	<div class="title-row">
		<h1><a href="/g/{sync.groupId}">{sync.state.group.name}</a></h1>
		<ShareButton path="/g/{sync.groupId}" />
	</div>
</header>

{@render children()}

{#if ctx.showPicker && !sync.gone}
	<MemberPicker
		groupName={sync.state.group.name}
		members={sync.state.members}
		onPick={(member) => ctx.identify(member.id)}
		onJoin={(name) => ctx.joinAs(name)}
	/>
{/if}

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

	.home {
		font-size: 0.8rem;
		font-weight: 600;
		text-decoration: none;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.home:hover {
		color: var(--accent);
	}

	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.25rem;
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
