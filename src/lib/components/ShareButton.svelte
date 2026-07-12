<script lang="ts">
	let { path }: { path: string } = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout>;

	async function copy() {
		const url = new URL(path, location.origin).href;
		try {
			await navigator.clipboard.writeText(url);
		} catch {
			// Clipboard API unavailable (e.g., plain http on LAN) — fall back to share sheet
			if (navigator.share) {
				try {
					await navigator.share({ url });
				} catch {
					return;
				}
			}
		}
		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = false), 2000);
	}
</script>

<button class="btn-quiet" onclick={copy}>
	{copied ? 'Link copied!' : 'Copy link'}
</button>
