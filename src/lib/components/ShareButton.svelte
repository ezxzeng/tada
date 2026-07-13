<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { forgetGroup, rememberGroup } from '$lib/client/recents';
	import type { GroupState } from '$lib/types';

	let { path }: { path: string } = $props();

	let dialog: HTMLDialogElement;
	let urlInput: HTMLInputElement;
	let url = $state('');
	let copied = $state(false);
	let regenerating = $state(false);
	let regenerateFailed = $state(false);
	let timer: ReturnType<typeof setTimeout>;

	const canShare = browser && !!navigator.share;

	function open() {
		url = new URL(path, location.origin).href;
		copied = false;
		clearTimeout(timer);
		dialog.showModal();
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			clearTimeout(timer);
			timer = setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard API unavailable (e.g., plain http on LAN) — leave the
			// URL selected so a manual copy is one keystroke away
			urlInput.select();
		}
	}

	async function share() {
		try {
			await navigator.share({ url });
		} catch {
			// user dismissed the share sheet
		}
	}

	async function regenerate() {
		if (regenerating) return;
		const confirmed = confirm(
			'Generate a new link? The current share link will stop working immediately. Scoped integrations will keep working.'
		);
		if (!confirmed) return;

		regenerating = true;
		regenerateFailed = false;
		try {
			const groupId = path.split('/').at(-1);
			if (!groupId) throw new Error('missing group ID');
			const res = await fetch(`/api/groups/${groupId}/regenerate-link`, { method: 'POST' });
			if (!res.ok) throw new Error(`regenerate failed: ${res.status}`);
			const state = (await res.json()) as GroupState;
			forgetGroup(groupId);
			rememberGroup(state.group.id, state.group.name);
			dialog.close();
			await goto(`/g/${state.group.id}`);
		} catch {
			regenerateFailed = true;
			regenerating = false;
		}
	}

	// The dialog has no padding of its own, so a click landing on the <dialog>
	// element itself can only be on the backdrop.
	function onDialogClick(e: MouseEvent) {
		if (e.target === dialog) dialog.close();
	}
</script>

<button class="icon-btn trigger" onclick={open} aria-label="Share this group" title="Share this group">
	<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
		<path
			d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
</button>

<dialog bind:this={dialog} onclick={onDialogClick}>
	<div class="body">
		<div class="header">
			<h2>Share this group</h2>
			<button class="icon-btn" onclick={() => dialog.close()} aria-label="Close" title="Close">
				<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
					<path
						d="M6 6l12 12M18 6 6 18"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
			</button>
		</div>

		<p class="warning">
			Anyone with this link can view and edit all lists in this group.
		</p>

		<div class="link-row">
			<input
				type="text"
				readonly
				value={url}
				bind:this={urlInput}
				onfocus={() => urlInput.select()}
			/>
			<button
				class="icon-btn"
				onclick={copy}
				aria-label={copied ? 'Link copied' : 'Copy link'}
				title="Copy link"
			>
				{#if copied}
					<svg class="check" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
						<path
							d="M20 6 9 17l-5-5"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
						<rect
							x="9"
							y="9"
							width="12"
							height="12"
							rx="2"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						/>
						<path
							d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				{/if}
			</button>
			{#if canShare}
				<button class="icon-btn" onclick={share} aria-label="Share link" title="Share link">
					<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
						<path
							d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			{/if}
		</div>

		<div class="regenerate">
			<div>
				<strong>Need to revoke this link?</strong>
				<p>Generate a new one. The old link will return not found, but your lists stay.</p>
			</div>
			<button class="btn-quiet" onclick={regenerate} disabled={regenerating}>
				{regenerating ? 'Generating…' : 'Generate new link'}
			</button>
		</div>
		{#if regenerateFailed}
			<p class="error">Couldn’t generate a new link. Please try again.</p>
		{/if}
	</div>
</dialog>

<style>
	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		color: var(--muted);
		background: var(--card);
		border: 1px solid var(--border);
	}

	.icon-btn:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	.icon-btn .check {
		color: var(--accent);
	}

	dialog {
		width: min(26rem, calc(100vw - 2rem));
		padding: 0;
		background: var(--card);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 0.4);
	}

	.body {
		display: grid;
		gap: 0.75rem;
		padding: 1.25rem;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	h2 {
		font-size: 1.1rem;
	}

	.warning {
		padding: 0.6rem 0.8rem;
		font-size: 0.9rem;
		color: var(--danger);
		background: color-mix(in srgb, var(--danger) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
		border-radius: 10px;
	}

	.link-row {
		display: flex;
		align-items: stretch;
		gap: 0.5rem;
	}

	.link-row input {
		min-width: 0;
	}

	.regenerate {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}

	.regenerate strong {
		font-size: 0.9rem;
	}

	.regenerate p,
	.error {
		margin-top: 0.2rem;
		font-size: 0.8rem;
	}

	.regenerate p {
		color: var(--muted);
	}

	.error {
		color: var(--danger);
	}
</style>
