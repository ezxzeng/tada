# tada
![tada](src/lib/assets/tada-light.svg)

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
- Identity is attribution, not auth: `localStorage` remembers which member of each group this
  browser is. Anyone with the link can claim any name — that's the intended trust model.

Don't keep secrets in a list, and don't post group links publicly.
