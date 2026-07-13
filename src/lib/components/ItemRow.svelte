<script lang="ts">
	import type { Item } from '$lib/types';

	let {
		item,
		onToggle,
		onDelete,
		onSave,
		onPress
	}: {
		item: Item;
		onToggle: (item: Item) => void;
		onDelete: (item: Item) => void;
		onSave: (item: Item, title: string, note: string) => void;
		/** Drag-to-reorder: omit to render the row without a handle. */
		onPress?: (event: PointerEvent, item: Item) => void;
	} = $props();

	let editing = $state(false);
	let title = $state('');
	let note = $state('');
	let titleInput = $state<HTMLInputElement | null>(null);

	function setEditing(on: boolean) {
		editing = on;
	}

	// `autofocus` is unreliable for an element mounted mid-interaction, so the
	// editor claims focus itself.
	$effect(() => {
		if (editing) titleInput?.focus();
	});

	function startEdit() {
		title = item.title;
		note = item.note ?? '';
		setEditing(true);
	}

	function commit() {
		if (!editing) return;
		setEditing(false);
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
			setEditing(false);
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

<div class="card row" class:checked={item.checked}>
	<input
		type="checkbox"
		checked={item.checked}
		onchange={() => onToggle(item)}
		aria-label="Toggle {item.title}"
	/>

	{#if editing}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="edit" onkeydown={onKeydown} onfocusout={onFocusout}>
			<input
				type="text"
				bind:this={titleInput}
				bind:value={title}
				maxlength="200"
				aria-label="Item"
			/>
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

	{#if onPress}
		<span
			class="handle"
			role="button"
			tabindex="-1"
			aria-label="Reorder {item.title}"
			onpointerdown={(event) => onPress?.(event, item)}
		>
			⠿
		</span>
	{:else}
		<!-- Keeps the delete button in line with the reorderable rows above. -->
		<span class="handle" aria-hidden="true"></span>
	{/if}
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.3rem 0.6rem 0.3rem 0.8rem;
		min-height: 3rem;
	}

	/* The only draggable part of the row. `touch-action: none` keeps the browser from
	   claiming the gesture as a page scroll, so the drag starts on the first move. */
	.handle {
		flex-shrink: 0;
		/* A finger-sized target: the grip glyph itself is only a few px wide. */
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 2.75rem;
		min-height: 2.75rem;
		color: var(--muted);
		font-size: 1.1rem;
		line-height: 1;
		touch-action: none;
		-webkit-user-select: none;
		user-select: none;
		-webkit-touch-callout: none;
	}

	.handle:hover {
		color: var(--text);
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
