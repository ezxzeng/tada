<script lang="ts">
	import { page } from '$app/state';
	import { getGroupSync } from '$lib/client/context.svelte';
	import {
		WEBHOOK_ACTIONS,
		type CreatedWebhookIntegration,
		type WebhookAction,
		type WebhookIntegration
	} from '$lib/types';

	let { data } = $props();
	const sync = getGroupSync();

	// Deliberately seed local mutable state from the initial server load.
	// svelte-ignore state_referenced_locally
	let integrations = $state<WebhookIntegration[]>(data.integrations);
	let name = $state('Home Assistant');
	let listId = $state(sync.state.lists[0]?.id ?? '');
	let actions = $state<WebhookAction[]>(['add']);
	let creating = $state(false);
	let createError = $state('');
	let revokeError = $state('');
	let revoking = $state<string | null>(null);
	let created = $state<CreatedWebhookIntegration | null>(null);
	let copied = $state('');

	const actionLabels: Record<WebhookAction, string> = {
		add: 'Add items',
		complete: 'Complete items',
		uncomplete: 'Uncomplete items',
		remove: 'Remove items',
		status: 'Read list status'
	};

	function toggleAction(action: WebhookAction) {
		actions = actions.includes(action)
			? actions.filter((candidate) => candidate !== action)
			: [...actions, action];
	}

	async function createIntegration(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim() || !listId || actions.length === 0 || creating) return;
		creating = true;
		createError = '';
		try {
			const response = await fetch(`/api/groups/${sync.groupId}/integrations`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name, listId, actions })
			});
			if (!response.ok) throw new Error(`create failed: ${response.status}`);
			created = (await response.json()) as CreatedWebhookIntegration;
			integrations = [created, ...integrations];
			name = 'Home Assistant';
			actions = ['add'];
		} catch {
			createError = 'Couldn’t create the integration. Please try again.';
		} finally {
			creating = false;
		}
	}

	async function revoke(integration: WebhookIntegration) {
		if (revoking || !confirm(`Revoke “${integration.name}”? It will stop working immediately.`)) return;
		revoking = integration.id;
		revokeError = '';
		try {
			const response = await fetch(
				`/api/groups/${sync.groupId}/integrations/${integration.id}`,
				{ method: 'DELETE' }
			);
			if (!response.ok) throw new Error(`revoke failed: ${response.status}`);
			integrations = integrations.filter((candidate) => candidate.id !== integration.id);
			if (created?.id === integration.id) created = null;
		} catch {
			revokeError = 'Couldn’t revoke the integration. Please try again.';
		} finally {
			revoking = null;
		}
	}

	function endpoint(integrationId: string): string {
		return `${page.url.origin}/api/hooks/${integrationId}`;
	}

	function commandName(integration: WebhookIntegration): string {
		const slug = integration.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '');
		return `tada_${slug || 'list'}`;
	}

	function homeAssistantYaml(integration: CreatedWebhookIntegration): string {
		const command = commandName(integration);
		return `# secrets.yaml
${command}_authorization: "Bearer ${integration.secret}"

# configuration.yaml
rest_command:
  ${command}:
    url: "${endpoint(integration.id)}"
    method: post
    headers:
      authorization: !secret ${command}_authorization
      accept: "application/json"
    content_type: "application/json"
    payload: >-
      {{ {"action": action, "items": ([item] if item is defined and item else [])} | tojson }}`;
	}

	async function copy(value: string, key: string) {
		try {
			await navigator.clipboard.writeText(value);
			copied = key;
			setTimeout(() => {
				if (copied === key) copied = '';
			}, 1800);
		} catch {
			copied = '';
		}
	}
</script>

<svelte:head>
	<title>Settings · {sync.state.group.name} · tada</title>
</svelte:head>

<section class="intro">
	<h2>Integrations</h2>
	<p class="muted">
		Give Home Assistant or another automation access to one list without sharing the group link.
		Each integration can be revoked independently.
	</p>
</section>

{#if created}
	<section class="created card">
		<div class="created-head">
			<div>
				<p class="eyebrow">Integration created</p>
				<h3>{created.name}</h3>
			</div>
			<button class="btn-quiet" onclick={() => (created = null)}>Done</button>
		</div>
		<p class="warning">
			Copy this setup now. The secret is shown only once; if it is lost, revoke this integration
			and create another.
		</p>

		<div class="value-block">
			<div class="value-label">
				<strong>Endpoint</strong>
				<button onclick={() => copy(endpoint(created!.id), 'endpoint')}>
					{copied === 'endpoint' ? 'Copied' : 'Copy'}
				</button>
			</div>
			<code>{endpoint(created.id)}</code>
		</div>

		<div class="value-block">
			<div class="value-label">
				<strong>Bearer secret</strong>
				<button onclick={() => copy(created!.secret, 'secret')}>
					{copied === 'secret' ? 'Copied' : 'Copy'}
				</button>
			</div>
			<code>{created.secret}</code>
		</div>

		<div class="setup-head">
			<div>
				<h3>Home Assistant setup</h3>
				<p class="muted">Add the secret and REST command, restart Home Assistant, then test the action.</p>
			</div>
			<button class="btn-quiet" onclick={() => copy(homeAssistantYaml(created!), 'yaml')}>
				{copied === 'yaml' ? 'Copied' : 'Copy YAML'}
			</button>
		</div>
		<pre><code>{homeAssistantYaml(created)}</code></pre>
		<p class="small muted">
			The secret stays in <code>secrets.yaml</code>. Home Assistant sends it in the Authorization
			header; it never needs your group link. Use the REST command from scripts, automations,
			dashboards, or an Assist sentence trigger. Call <code>rest_command.{commandName(created)}</code>
			with <code>action: {created.actions[0]}</code> and, for write actions, <code>item: Milk</code>.
		</p>
		<p class="small muted">
			For a fixed Google Assistant phrase, wrap this REST command in a Home Assistant script and
			expose that script to Google Assistant as a scene.
		</p>
	</section>
{/if}

<section class="card create">
	<h3>Create an integration</h3>
	{#if sync.state.lists.length === 0}
		<p class="muted">Create a list before adding an integration.</p>
	{:else}
		<form onsubmit={createIntegration}>
			<label>
				<span>Name</span>
				<input type="text" bind:value={name} maxlength="80" placeholder="Kitchen Home Assistant" />
			</label>

			<label>
				<span>List</span>
				<select bind:value={listId}>
					{#each sync.state.lists as list}
						<option value={list.id}>{list.name}</option>
					{/each}
				</select>
			</label>

			<fieldset>
				<legend>Allowed actions</legend>
				<div class="checks">
					{#each WEBHOOK_ACTIONS as action}
						<label class="check">
							<input
								type="checkbox"
								checked={actions.includes(action)}
								onchange={() => toggleAction(action)}
							/>
							<span>{actionLabels[action]}</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<div class="form-footer">
				<p class="muted">Start with only the actions this device needs.</p>
				<button
					class="btn"
					disabled={creating || !name.trim() || !listId || actions.length === 0}
				>
					{creating ? 'Creating…' : 'Create integration'}
				</button>
			</div>
			{#if createError}<p class="error">{createError}</p>{/if}
		</form>
	{/if}
</section>

<section class="existing">
	<h3>Active integrations</h3>
	{#if revokeError}<p class="error revoke-error">{revokeError}</p>{/if}
	{#if integrations.length === 0}
		<p class="empty muted">No integrations yet.</p>
	{:else}
		<ul>
			{#each integrations as integration (integration.id)}
				<li class="card integration">
					<div class="integration-main">
						<strong>{integration.name}</strong>
						<p class="muted">
							{integration.list.name} · {integration.actions.map((action) => actionLabels[action]).join(', ')}
						</p>
						<p class="meta muted">
							Created {integration.createdAt.slice(0, 10)} ·
							{integration.lastUsedAt ? `last used ${integration.lastUsedAt.slice(0, 10)}` : 'never used'}
						</p>
					</div>
					<button
						class="revoke"
						onclick={() => revoke(integration)}
						disabled={revoking === integration.id}
					>
						{revoking === integration.id ? 'Revoking…' : 'Revoke'}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.intro {
		margin-bottom: 1rem;
	}

	.intro h2 {
		font-size: 1.25rem;
	}

	.intro p {
		margin-top: 0.25rem;
	}

	.card {
		padding: 1rem;
	}

	.created {
		display: grid;
		gap: 1rem;
		margin-bottom: 1rem;
		border-color: var(--accent);
	}

	.created-head,
	.setup-head,
	.form-footer,
	.integration {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.eyebrow {
		color: var(--accent);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.warning {
		padding: 0.65rem 0.75rem;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
		border-radius: 10px;
		background: var(--accent-soft);
		font-size: 0.88rem;
	}

	.value-block {
		min-width: 0;
	}

	.value-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.3rem;
		font-size: 0.85rem;
	}

	.value-label button,
	.revoke {
		color: var(--accent);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.value-block > code {
		display: block;
		padding: 0.65rem;
		overflow-wrap: anywhere;
		border-radius: 8px;
		background: var(--bg);
		font-size: 0.8rem;
	}

	.setup-head p {
		font-size: 0.82rem;
	}

	pre {
		max-height: 25rem;
		margin: 0;
		padding: 0.8rem;
		overflow: auto;
		border-radius: 8px;
		background: var(--bg);
		font-size: 0.76rem;
		line-height: 1.45;
	}

	.small {
		font-size: 0.82rem;
	}

	.create {
		margin-bottom: 1.5rem;
	}

	.create h3,
	.existing > h3 {
		margin-bottom: 0.75rem;
		font-size: 1rem;
	}

	form {
		display: grid;
		gap: 0.9rem;
	}

	form > label > span,
	legend {
		display: block;
		margin-bottom: 0.3rem;
		font-size: 0.85rem;
		font-weight: 600;
	}

	select {
		width: 100%;
		padding: 0.65rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--card);
		color: var(--text);
		font: inherit;
	}

	fieldset {
		padding: 0;
		border: 0;
	}

	.checks {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 0.45rem;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--border);
		border-radius: 9px;
		font-size: 0.87rem;
		cursor: pointer;
	}

	.check:has(input:checked) {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.form-footer p {
		font-size: 0.82rem;
	}

	.error {
		color: var(--danger);
		font-size: 0.85rem;
	}

	.existing ul {
		display: grid;
		gap: 0.6rem;
	}

	.integration-main {
		min-width: 0;
	}

	.integration-main p {
		margin-top: 0.15rem;
		font-size: 0.84rem;
		overflow-wrap: anywhere;
	}

	.integration-main .meta {
		font-size: 0.75rem;
	}

	.revoke-error {
		margin-bottom: 0.6rem;
	}

	.revoke {
		flex: none;
		color: var(--danger);
	}

	.revoke:disabled {
		opacity: 0.5;
	}

	.empty {
		padding: 1.5rem 0;
		text-align: center;
	}

	@media (max-width: 32rem) {
		.setup-head,
		.form-footer,
		.integration {
			align-items: flex-start;
			flex-direction: column;
		}

		.form-footer .btn {
			width: 100%;
		}
	}
</style>
