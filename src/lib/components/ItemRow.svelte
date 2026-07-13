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

	function commit() {
		if (!editing) return;
		editing = false;
		const trimmedTitle = title.trim();
		const trimmedNote = note.trim();
		if (!trimmedTitle) return;
		if (trimmedTitle === item.title && trimmedNote === (item.note ?? '')) return;
		onSave(item, trimmedTitle, trimmedNote);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commit();
		} else if (event.key === 'Escape') {
			editing = false;
		}
	}

	// Commit when focus leaves the row entirely, not when it moves between the
	// title and note inputs.
	function onFocusout(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next instanceof Node && event.currentTarget instanceof Node) {
			if (event.currentTarget.contains(next)) return;
		}
		commit();
	}
</script>

<li class="card" class:checked={item.checked}>
	<input
		type="checkbox"
		checked={item.checked}
		onchange={() => onToggle(item)}
		aria-label="Toggle {item.title}"
	/>

	{#if editing}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="edit" onkeydown={onKeydown} onfocusout={onFocusout}>
			<!-- svelte-ignore a11y_autofocus -->
			<input type="text" bind:value={title} maxlength="200" aria-label="Item" autofocus />
			<input
				type="text"
				class="note-input"
				bind:value={note}
				maxlength="300"
				placeholder="Qty / note"
				aria-label="Quantity or note"
			/>
		</div>
	{:else}
		<button class="text" onclick={startEdit} aria-label="Edit {item.title}">
			<span class="title">{item.title}</span>
			{#if item.note}<span class="note muted">{item.note}</span>{/if}
		</button>
	{/if}

	<button class="icon danger" onclick={() => onDelete(item)} aria-label="Delete {item.title}">
		✕
	</button>
</li>

<style>
	li {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.3rem 0.6rem 0.3rem 0.8rem;
		min-height: 3rem;
	}

	input[type='checkbox'] {
		width: 1.3rem;
		height: 1.3rem;
		accent-color: var(--accent);
		flex-shrink: 0;
		cursor: pointer;
	}

	.text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		flex: 1;
		min-width: 0;
		padding: 0.4rem 0;
		text-align: left;
		color: inherit;
		cursor: text;
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

	.edit {
		display: flex;
		flex: 1;
		min-width: 0;
		gap: 0.5rem;
		padding: 0.4rem 0;
	}

	.edit input {
		flex: 1 1 auto;
		min-width: 0;
	}

	.note-input {
		flex: 0 1 8.5rem;
	}

	@media (max-width: 480px) {
		.note-input {
			flex-basis: 6.5rem;
		}
	}

	.icon {
		padding: 0.5rem;
		color: var(--muted);
		font-size: 1rem;
		flex-shrink: 0;
	}

	.icon.danger:hover {
		color: var(--danger);
	}
</style>
