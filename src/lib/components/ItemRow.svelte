<script lang="ts">
	import type { Item } from '$lib/types';

	let {
		item,
		onToggle,
		onDelete,
		onSave
	}: {
		item: Item;
		onToggle: (item: Item) => void;
		onDelete: (item: Item) => void;
		onSave: (item: Item, title: string, note: string) => void;
	} = $props();

	let editing = $state(false);
	let title = $state('');
	let note = $state('');

	function startEdit() {
		title = item.title;
		note = item.note ?? '';
		editing = true;
	}

	function save(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = title.trim();
		if (!trimmed) return;
		onSave(item, trimmed, note.trim());
		editing = false;
	}
</script>

<li class="card" class:checked={item.checked}>
	{#if editing}
		<form class="edit" onsubmit={save}>
			<!-- svelte-ignore a11y_autofocus -->
			<input type="text" bind:value={title} maxlength="200" aria-label="Item" autofocus />
			<input
				type="text"
				bind:value={note}
				maxlength="300"
				placeholder="Qty / note"
				aria-label="Quantity or note"
			/>
			<div class="edit-actions">
				<button type="button" class="btn-quiet" onclick={() => (editing = false)}>Cancel</button>
				<button class="btn" disabled={!title.trim()}>Save</button>
			</div>
		</form>
	{:else}
		<label class="row">
			<input type="checkbox" checked={item.checked} onchange={() => onToggle(item)} />
			<span class="text">
				<span class="title">{item.title}</span>
				{#if item.note}<span class="note muted">{item.note}</span>{/if}
			</span>
		</label>
		<button class="icon" onclick={startEdit} aria-label="Edit {item.title}">✎</button>
		<button class="icon danger" onclick={() => onDelete(item)} aria-label="Delete {item.title}">
			✕
		</button>
	{/if}
</li>

<style>
	li {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.6rem 0.3rem 0.8rem;
		min-height: 3rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex: 1;
		min-width: 0;
		cursor: pointer;
		padding: 0.4rem 0;
	}

	input[type='checkbox'] {
		width: 1.3rem;
		height: 1.3rem;
		accent-color: var(--accent);
		flex-shrink: 0;
	}

	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.title,
	.note {
		overflow-wrap: anywhere;
	}

	.checked .title {
		text-decoration: line-through;
		color: var(--muted);
	}

	.note {
		font-size: 0.85rem;
	}

	.icon {
		padding: 0.5rem;
		color: var(--muted);
		font-size: 1rem;
		flex-shrink: 0;
	}

	.icon:hover {
		color: var(--text);
	}

	.icon.danger:hover {
		color: var(--danger);
	}

	.edit {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.4rem 0;
	}

	.edit input {
		flex: 1 1 10rem;
	}

	.edit-actions {
		display: flex;
		gap: 0.5rem;
		margin-left: auto;
	}
</style>
