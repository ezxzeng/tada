<script lang="ts">
	let {
		label,
		onPress
	}: {
		label: string;
		onPress?: (event: PointerEvent) => void;
	} = $props();
</script>

{#if onPress}
	<span
		class="drag-handle"
		role="button"
		tabindex="-1"
		aria-label={label}
		onpointerdown={onPress}
	>
		⠿
	</span>
{:else}
	<span class="drag-handle" aria-hidden="true"></span>
{/if}

<style>
	/* A finger-sized target around the narrow grip glyph. Preventing the browser from
	   claiming touch gestures lets DragSort track from the first move. */
	.drag-handle {
		flex-shrink: 0;
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

	.drag-handle:hover {
		color: var(--text);
	}
</style>
