<script lang="ts">
	import MemberChip from './MemberChip.svelte';
	import type { Member } from '$lib/types';

	let {
		groupName,
		members,
		onPick,
		onJoin
	}: {
		groupName: string;
		members: Member[];
		onPick: (member: Member) => void;
		onJoin: (name: string) => Promise<boolean>;
	} = $props();

	let name = $state('');
	let busy = $state(false);
	let failed = $state(false);

	async function join(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = name.trim();
		if (!trimmed || busy) return;
		busy = true;
		failed = false;
		const ok = await onJoin(trimmed);
		busy = false;
		failed = !ok;
	}
</script>

<div class="overlay">
	<div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="picker-title">
		<h2 id="picker-title">Who are you?</h2>
		<p class="muted">
			Joining <strong>{groupName}</strong> — your name shows next to items you add or check off.
		</p>

		{#if members.length > 0}
			<div class="choices">
				{#each members as member (member.id)}
					<button class="choice" onclick={() => onPick(member)}>
						<MemberChip name={member.name} />
						{member.name}
					</button>
				{/each}
			</div>
			<div class="divider muted">or join as someone new</div>
		{/if}

		<form onsubmit={join}>
			<input
				type="text"
				bind:value={name}
				placeholder="Your name"
				maxlength="40"
				aria-label="Your name"
			/>
			<button class="btn" disabled={busy || !name.trim()}>Join</button>
		</form>
		{#if failed}
			<p class="error">Couldn't join — check your connection and try again.</p>
		{/if}
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgb(8 12 18 / 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		z-index: 10;
	}

	.dialog {
		width: 100%;
		max-width: 24rem;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.choices {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.choice {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		text-align: left;
		font-weight: 600;
	}

	.choice:hover {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.divider {
		text-align: center;
		font-size: 0.85rem;
	}

	form {
		display: flex;
		gap: 0.5rem;
	}

	.error {
		color: var(--danger);
		font-size: 0.9rem;
	}
</style>
