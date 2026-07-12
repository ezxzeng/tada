<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} · tada</title>
</svelte:head>

<div class="wrap">
	<h1>{page.status}</h1>
	<p class="muted">
		{#if page.status === 404}
			Nothing here — the link may be mistyped, or this group was deleted.
		{:else}
			{page.error?.message ?? 'Something went wrong.'}
		{/if}
	</p>
	<a class="btn" href="/">Go home</a>
</div>

<style>
	.wrap {
		text-align: center;
		padding-top: 4rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	h1 {
		font-size: 3rem;
	}

	.btn {
		text-decoration: none;
	}
</style>
