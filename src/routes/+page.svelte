<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		forgetGroup,
		getRecentGroups,
		rememberGroup,
		type RecentGroup
	} from '$lib/client/recents';
	import type { GroupState } from '$lib/types';

	let groupName = $state('');
	let listName = $state('Groceries');
	let busy = $state(false);
	let failed = $state(false);
	let recents = $state<RecentGroup[]>([]);

	$effect(() => {
		recents = getRecentGroups();
	});

	async function create(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		busy = true;
		failed = false;
		try {
			const res = await fetch('/api/groups', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					groupName: groupName.trim(),
					listName: listName.trim() || 'Groceries'
				})
			});
			if (!res.ok) throw new Error(`create failed: ${res.status}`);
			const data = (await res.json()) as GroupState;
			rememberGroup(data.group.id, data.group.name);
			await goto(`/g/${data.group.id}`);
		} catch {
			failed = true;
			busy = false;
		}
	}

	function remove(id: string) {
		forgetGroup(id);
		recents = getRecentGroups();
	}
</script>

<svelte:head>
	<title>tada · shared lists, no accounts</title>
	<meta name="description" content="Shared todo and grocery lists. No accounts — just share a link." />
</svelte:head>

<header class="hero">
	<h1>tada</h1>
	<p class="muted">
		Shared lists without accounts. Create a group, send the link to your roommates, done.
	</p>
</header>

<section class="card create">
	<h2>Create a group</h2>
	<form onsubmit={create}>
		<label>
			<span>Group name</span>
			<input type="text" bind:value={groupName} placeholder="Apartment 4B" maxlength="80" required />
		</label>
		<label>
			<span>First list</span>
			<input type="text" bind:value={listName} placeholder="Groceries" maxlength="80" />
		</label>
		<button class="btn" disabled={busy || !groupName.trim()}>
			{busy ? 'Creating…' : 'Create group'}
		</button>
		{#if failed}
			<p class="error">Couldn't create the group — check your connection and try again.</p>
		{/if}
	</form>
</section>

{#if recents.length > 0}
	<section class="recents">
		<h2 class="muted">Your groups</h2>
		<ul>
			{#each recents as recent (recent.id)}
				<li class="card">
					<a href="/g/{recent.id}">{recent.name}</a>
					<button
						class="forget"
						onclick={() => remove(recent.id)}
						aria-label="Remove {recent.name} from this device"
						title="Remove from this device"
					>
						✕
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<p class="hint muted">
	Anyone who has a group's link can view and edit it — that's the whole idea. Don't keep secrets
	in a list, and don't post links publicly.
</p>

<style>
	.hero {
		text-align: center;
		padding: 2rem 0 1.5rem;
	}

	.hero h1 {
		font-size: 2rem;
		letter-spacing: -0.02em;
	}

	.create {
		padding: 1.25rem;
	}

	.create h2 {
		font-size: 1.1rem;
		margin-bottom: 0.9rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	label span {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--muted);
	}

	.error {
		color: var(--danger);
		font-size: 0.9rem;
	}

	.recents {
		margin-top: 1.75rem;
	}

	.recents h2 {
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.6rem;
	}

	.recents ul {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.recents li {
		display: flex;
		align-items: center;
	}

	.recents a {
		flex: 1;
		padding: 0.85rem 1rem;
		font-weight: 600;
		text-decoration: none;
	}

	.forget {
		padding: 0.85rem 1rem;
		color: var(--muted);
	}

	.forget:hover {
		color: var(--danger);
	}

	.hint {
		margin-top: 1.75rem;
		font-size: 0.85rem;
		text-align: center;
	}
</style>
