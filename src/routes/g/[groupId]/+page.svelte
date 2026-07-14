<script lang="ts">
	import { goto } from '$app/navigation';
	import { getGroupSync } from '$lib/client/context.svelte';
	import { DragSort } from '$lib/client/dragsort.svelte';
	import DragHandle from '$lib/components/DragHandle.svelte';
	import type { TodoList } from '$lib/types';

	const sync = getGroupSync();
	const sort = new DragSort((ids) => void sync.reorderLists(ids));

	let newListName = $state('');
	let addingList = $state(false);

	function remaining(list: TodoList): number {
		return list.items.filter((i) => !i.checked).length;
	}

	async function addList(event: SubmitEvent) {
		event.preventDefault();
		const name = newListName.trim();
		if (!name || addingList) return;
		addingList = true;
		const listId = await sync.addList(name);
		addingList = false;
		newListName = '';
		if (listId) await goto(`/g/${sync.groupId}/${listId}`);
	}
</script>

<ul class="lists drag-sort" class:settling={sort.settling}>
	{#each sync.state.lists as list (list.id)}
		<li
			class="drag-sort-row"
			data-drag-id={list.id}
			class:dragging={sort.activeId === list.id}
			style="transform: translateY({sort.offsetOf(list.id)}px)"
		>
			<div class="card list-row">
				<a class="list-link" href="/g/{sync.groupId}/{list.id}">
					<span class="name">{list.name}</span>
					<span class="count muted">
						{#if list.items.length === 0}
							empty
						{:else if remaining(list) === 0}
							all done ✓
						{:else}
							{remaining(list)} to go
						{/if}
					</span>
					<span class="chevron muted" aria-hidden="true">›</span>
				</a>
				<DragHandle
					label="Reorder {list.name}"
					onPress={sync.state.lists.length > 1
						? (event) => sort.press(event, list.id)
						: undefined}
				/>
			</div>
		</li>
	{/each}
</ul>

{#if sync.state.lists.length === 0}
	<p class="empty muted">No lists yet — add one below.</p>
{/if}

<form class="add" onsubmit={addList}>
	<input
		type="text"
		bind:value={newListName}
		placeholder="New list (e.g. Chores)"
		maxlength="80"
		aria-label="New list name"
	/>
	<button class="btn" disabled={addingList || !newListName.trim()}>Add list</button>
</form>

<p class="hint muted">Share the link above — anyone who has it can view and edit this group.</p>

<style>
	.lists {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.list-row {
		display: flex;
		align-items: center;
	}

	.list-link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
		min-width: 0;
		padding: 1rem 0 1rem 1.1rem;
		text-decoration: none;
	}

	.list-row:hover {
		border-color: var(--accent);
	}

	.name {
		flex: 1;
		font-weight: 600;
		font-size: 1.05rem;
		overflow-wrap: anywhere;
	}

	.count {
		font-size: 0.85rem;
		white-space: nowrap;
	}

	.chevron {
		font-size: 1.3rem;
		line-height: 1;
	}

	.empty {
		text-align: center;
		padding: 1.5rem 0;
	}

	.add {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.hint {
		margin-top: 1.5rem;
		font-size: 0.85rem;
		text-align: center;
	}
</style>
