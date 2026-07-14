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
- **No signup** — link is the only credential by design. Don't put anything sensitive up
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
  In the share dialog, **Generate new link** rotates that ID without changing the group’s data.
  The previous share URL then returns 404. Scoped integrations keep working because they use
  independent credentials.
- Every mutation bumps `groups.version`. Clients poll `GET /api/groups/[groupId]?since=<version>`
  (only while the tab is visible) and get a tiny "unchanged" reply or the full group state.
  Mutations respond with fresh state too, and the UI applies changes optimistically.
- Anyone with the link can access the group and its lists — that's the intended trust model.

Don't keep secrets in a list, and don't post group links publicly.

## Integrations (Home Assistant, voice assistants, IoT)

Integrations use credentials that are separate from the group share link. In a group's
**Settings** tab, create a named integration, bind it to one list, and grant only the actions it
needs. The generated secret is shown once and stored in the database only as a SHA-256 hash.
Each integration can be revoked independently, and rotating the human share link does not break it.

The settings page provides a ready-to-copy Home Assistant configuration. The underlying endpoint is:

```
POST https://<your-deployment>/api/hooks/<integrationId>
Authorization: Bearer <one-time-secret>
Content-Type: application/json
```

The URL contains a public selector, not the credential. The JSON body accepts:

| field | meaning |
| ----- | ------- |
| `action` | `add` · `complete` · `uncomplete` · `remove` · `status` |
| `items` | up to 20 item titles; required except for `status` |
| `note` | optional note when adding |

The list is fixed when the integration is created and cannot be overridden by the caller. An action
returns 403 unless it was explicitly granted. Requests are limited to 16 KiB and 60 calls per minute
per integration; responses use `Cache-Control: no-store`, and the endpoint does not enable browser
CORS.

```sh
curl -X POST 'https://tada.example/api/hooks/hook_PUBLIC_ID' \
  -H 'authorization: Bearer tada_whsec_SECRET' \
  -H 'content-type: application/json' \
  -d '{"action":"add","items":["Milk","Eggs"],"note":"2%"}'
```

Item titles match case-insensitively. `add` does not duplicate an unchecked item and restores a
checked item; completing or uncompleting an item already in the requested state is a successful
no-op. Every response includes a short `speech` sentence suitable for Home Assistant Assist.

### Home Assistant

Store the generated bearer value in `secrets.yaml`, then add the generated
[`rest_command`](https://www.home-assistant.io/integrations/rest_command/) to `configuration.yaml`:

```yaml
# secrets.yaml
tada_home_assistant_authorization: "Bearer tada_whsec_SECRET"

# configuration.yaml
rest_command:
  tada_home_assistant:
    url: "https://tada.example/api/hooks/hook_PUBLIC_ID"
    method: post
    headers:
      authorization: !secret tada_home_assistant_authorization
      accept: "application/json"
    content_type: "application/json"
    payload: >-
      {{ {"action": action, "items": ([item] if item is defined and item else [])} | tojson }}
```

After restarting Home Assistant, call it from an automation, dashboard, script, or Developer tools:

```yaml
- action: rest_command.tada_home_assistant
  data:
    action: add
    item: Milk
  response_variable: tada_response
```

Home Assistant Assist can pass a wildcard sentence slot as `item`. Google Assistant can activate a
fixed Home Assistant script exposed as a scene; arbitrary spoken item names are better handled by
Home Assistant Assist because Google Home does not provide a generic authenticated HTTP action.

The former `/api/groups/<groupId>/webhook` endpoint is retired and returns 410. It reused the share
link as an integration credential, so disclosing an automation URL also disclosed full group access.
