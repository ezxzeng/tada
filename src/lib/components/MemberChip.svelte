<script lang="ts">
	import { memberHue, memberInitial } from '$lib/client/avatar';

	let { name, small = false }: { name: string; small?: boolean } = $props();
</script>

<span class="chip" class:small style="--hue: {memberHue(name)}" title={name}>
	{memberInitial(name)}
</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 50%;
		background: hsl(var(--hue) 55% 42%);
		color: #fff;
		font-size: 0.85rem;
		font-weight: 700;
		flex-shrink: 0;
		user-select: none;
	}

	.chip.small {
		width: 1.35rem;
		height: 1.35rem;
		font-size: 0.7rem;
	}
</style>
