<script lang="ts">
	let { onAdd }: { onAdd: (title: string, note: string) => void } = $props();

	let title = $state('');
	let note = $state('');
	let titleInput: HTMLInputElement;

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = title.trim();
		if (!trimmed) {
			titleInput.focus();
			return;
		}
		onAdd(trimmed, note.trim());
		title = '';
		note = '';
		titleInput.focus();
	}
</script>

<form onsubmit={submit}>
	<input
		type="text"
		bind:this={titleInput}
		bind:value={title}
		placeholder="Add an item…"
		maxlength="200"
		aria-label="Item"
	/>
	<input
		type="text"
		class="note"
		bind:value={note}
		placeholder="Qty / note"
		maxlength="300"
		aria-label="Quantity or note"
	/>
	<button class="btn" class:empty={!title.trim()} aria-label="Add item">Add</button>
</form>

<style>
	form {
		display: flex;
		gap: 0.5rem;
	}

	.note {
		flex: 0 1 8.5rem;
	}

	.empty {
		opacity: 0.5;
	}

	@media (max-width: 480px) {
		.note {
			flex-basis: 6.5rem;
		}
	}
</style>
