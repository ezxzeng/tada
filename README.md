<picture>
  <source media="(prefers-color-scheme: dark)" srcset="src/lib/assets/tada-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="src/lib/assets/tada-light.svg">
  <img alt="tada" src="src/lib/assets/tada-light.svg" width="120">
</picture>

---

Shared todo/grocery lists without accounts, in the spirit of [spliit](https://github.com/spliit-app/spliit):
create a **group**, share its link, and anyone with the link can add, check off, and edit items.
The unguessable URL is the only credential.

- **Groups** hold multiple lists (Groceries, Chores, Costco run…) behind one share link
- **No signup** — on first visit you pick or enter your name (stored in localStorage) so items show who added/checked them
- **Live-ish sync** — open tabs poll a version counter every 3s and pick up everyone's changes
- SvelteKit (Svelte 5) · Drizzle ORM · Neon serverless Postgres · deploys to Vercel

## Setup

1. Create a free Postgres database at [neon.tech](https://neon.tech) (or via the Vercel → Storage → Neon integration).
2. Copy the connection string into `.env`:

   ```sh
   cp .env.example .env
   # DATABASE_URL      — the database you develop against
   # DATABASE_URL_PROD — the production database (local only; never set in Vercel)
   ```

3. Create the tables and run the dev server:

   ```sh
   npm install
   npm run db:push
   npm run dev
   ```

## Deploying to Vercel

The app reads `DATABASE_URL` at runtime. With the [Neon–Vercel integration](https://neon.com/docs/guides/neon-managed-vercel-integration)
that variable is injected into the Vercel project automatically (and preview deployments get their own
Neon branch), so there is nothing to configure by hand.

The integration does **not** apply schema changes — nothing in the Vercel build runs `drizzle-kit`.
Whenever you change `src/lib/server/db/schema.ts`, push the schema to production yourself, before
deploying the code that depends on it:

```sh
npm run db:push:prod   # uses DATABASE_URL_PROD from your local .env
git push               # Vercel builds and deploys
```

Pushing the schema first keeps the two in sync: additive changes (new tables/columns) are safe against
the running old code, whereas destructive ones (dropping or renaming a column) will break it, so ship
those as an additive push, then the code, then a cleanup push.

## How it works

- A group id is a 16-char nanoid (~95 bits of entropy); every API route is scoped under
  `/api/groups/[groupId]/…` and the server verifies each list/item actually belongs to that group.
- Every mutation bumps `groups.version`. Clients poll `GET /api/groups/[groupId]?since=<version>`
  (only while the tab is visible) and get a tiny "unchanged" reply or the full group state.
  Mutations respond with fresh state too, and the UI applies changes optimistically.
- Anyone with the link can access the group and its lists — that's the intended trust model.

Don't keep secrets in a list, and don't post group links publicly.

## Integrations (voice assistants, Home Assistant, IoT buttons)

Every group exposes a single permissive webhook at

```
POST https://<your-deployment>/api/groups/<groupId>/webhook
```

made for things that aren't the app: Home Assistant automations, Google Assistant routines,
ESPHome buttons, fridge-camera scripts. The group id (from the share link) is the credential,
so treat webhook URLs like the share link itself. Parameters go in the query string, a JSON
body, or a form body — whichever the caller can produce — with the body winning on conflicts:

| param  | meaning |
| ------ | ------- |
| `action` | `add` (default) · `complete` · `uncomplete` · `remove` · `status` (aliases: `check`/`done`, `uncheck`/`need`, `delete`, `get`) |
| `item` / `items` | item title(s); `item` may repeat, `items` may be a JSON array |
| `list` | list name (case-insensitive) or id; defaults to the group's **first list** |
| `note` | optional note when adding |

```sh
# "We're out of milk" — add to the group's first list; works from anything that can POST a URL
curl -X POST "https://tada.example/api/groups/GROUP_ID/webhook?item=Milk"

# Add to a named list with a note
curl -X POST https://tada.example/api/groups/GROUP_ID/webhook \
  -H 'content-type: application/json' \
  -d '{"list": "Groceries", "item": "Milk", "note": "2%"}'

# Fridge camera reporting what's missing (batch) and what's stocked
curl -X POST .../webhook -H 'content-type: application/json' \
  -d '{"action": "add", "list": "Groceries", "items": ["Milk", "Eggs"]}'
curl -X POST ".../webhook?action=complete&list=Groceries&item=Butter"

# "What's on the grocery list?" — GET returns status; `speech` is ready for TTS
curl ".../webhook?list=Groceries"
```

Item titles match case-insensitively, and the actions are safe to fire blindly from sensors:
`add` won't duplicate an item that's already on the list (and un-checks it if it was checked
off), and `complete`/`uncomplete` on an item already in that state still reports success.
Responses are small JSON summaries — e.g. `{ "ok": true, "action": "add", "list": {…},
"added": ["Milk"], …, "speech": "Added Milk to Groceries." }` — never the full group state,
and every response includes a `speech` sentence for voice assistants to read back. Missing
lists/groups return 404, malformed input 400; changes show up in open tabs within the normal
3-second poll. CORS is open, so a plain HTML "we need milk" button on a wall tablet works too.

With Home Assistant, wrap it in a [`rest_command`](https://www.home-assistant.io/integrations/rest_command/)
and call it from automations, dashboards, scripts, or Assist/Google Assistant:

```yaml
rest_command:
  add_grocery:
    url: "https://tada.example/api/groups/GROUP_ID/webhook"
    method: post
    content_type: application/json
    payload: '{"list": "Groceries", "item": "{{ item }}"}'
```
