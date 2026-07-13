<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getGroupSync } from '$lib/client/context.svelte';
	import { DragSort } from '$lib/client/dragsort.svelte';
	import AddItemForm from '$lib/components/AddItemForm.svelte';
	import ItemRow from '$lib/components/ItemRow.svelte';

	const sync = getGroupSync();

	const sort = new DragSort((ids) => {
		if (list) void sync.reorderItems(list.id, ids);
	});

	const list = $derived(sync.state.lists.find((l) => l.id === page.params.listId));
	const todo = $derived(list?.items.filter((i) => !i.checked) ?? []);
	const done = $derived(list?.items.filter((i) => i.checked) ?? []);

	let renaming = $state(false);
	let renameValue = $state('');

	function startRename() {
		if (!list) return;
		renameValue = list.name;
		renaming = true;
	}

	function saveRename(event: SubmitEvent) {
		event.preventDefault();
		const name = renameValue.trim();
		if (!list || !name) return;
		void sync.renameList(list.id, name);
		renaming = false;
	}

	async function removeList() {
		if (!list) return;
		if (!confirm(`Delete "${list.name}" and all its items?`)) return;
		await sync.deleteList(list.id);
		await goto(`/g/${sync.groupId}`);
	}
</script>

<nav class="crumb">
	<a class="muted" href="/g/{sync.groupId}">‹ All lists</a>
</nav>

{#if !list}
	<p class="empty muted">
		This list was deleted. <a href="/g/{sync.groupId}">Back to {sync.state.group.name}</a>
	</p>
{:else}
	{@const activeList = list}
	<div class="list-head">
		{#if renaming}
			<form class="rename" onsubmit={saveRename}>
				<!-- svelte-ignore a11y_autofocus -->
				<input type="text" bind:value={renameValue} maxlength="80" aria-label="List name" autofocus />
				<button type="button" class="btn-quiet" onclick={() => (renaming = false)}>Cancel</button>
				<button class="btn" disabled={!renameValue.trim()}>Save</button>
			</form>
		{:else}
			<h2>{activeList.name}</h2>
			<button class="icon" onclick={startRename} aria-label="Rename list">✎</button>
		{/if}
	</div>

	<AddItemForm onAdd={(title, note) => sync.addItem(activeList.id, title, note)} />

	<ul class="items">
		{#each todo as item (item.id)}
			<ItemRow
				{item}
				onToggle={(i) => sync.toggleItem(i)}
				onDelete={(i) => sync.deleteItem(i)}
				onSave={(i, title, note) => sync.editItem(i, title, note)}
				onPress={todo.length > 1 ? (event, i) => sort.press(event, i.id) : undefined}
				dragging={sort.activeId === item.id}
				offsetY={sort.offsetOf(item.id)}
			/>
		{/each}
	</ul>

	{#if todo.length === 0 && done.length === 0}
		<p class="empty muted">Nothing here yet — add the first item.</p>
	{:else if todo.length === 0}
		<p class="empty muted">All done ✓</p>
	{/if}

	{#if done.length > 0}
		<section class="done">
			<header>
				<h3 class="muted">Completed ({done.length})</h3>
				<button class="btn-quiet" onclick={() => sync.clearCompleted(activeList.id)}>
					Clear completed
				</button>
			</header>
			<ul class="items">
				{#each done as item (item.id)}
					<ItemRow
						{item}
						onToggle={(i) => sync.toggleItem(i)}
						onDelete={(i) => sync.deleteItem(i)}
						onSave={(i, title, note) => sync.editItem(i, title, note)}
					/>
				{/each}
			</ul>
		</section>
	{/if}

	<footer>
		<button class="delete-list" onclick={removeList}>Delete this list</button>
	</footer>
{/if}

<style>
	.crumb {
		margin-bottom: 0.5rem;
	}

	.crumb a {
		font-size: 0.9rem;
		text-decoration: none;
	}

	.crumb a:hover {
		color: var(--accent);
	}

	.list-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.9rem;
	}

	h2 {
		font-size: 1.25rem;
		overflow-wrap: anywhere;
	}

	.icon {
		padding: 0.4rem 0.5rem;
		color: var(--muted);
	}

	.icon:hover {
		color: var(--text);
	}

	.rename {
		display: flex;
		gap: 0.5rem;
		flex: 1;
	}

	.items {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.empty {
		text-align: center;
		padding: 1.5rem 0;
	}

	.done {
		margin-top: 1.75rem;
	}

	.done header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.6rem;
	}

	.done h3 {
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	footer {
		margin-top: 2.5rem;
		text-align: center;
	}

	.delete-list {
		color: var(--danger);
		font-size: 0.9rem;
		padding: 0.5rem 1rem;
	}

	.delete-list:hover {
		text-decoration: underline;
	}
</style>
