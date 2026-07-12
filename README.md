# tada

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
   # then edit .env and set DATABASE_URL=postgresql://...
   ```

3. Create the tables and run the dev server:

   ```sh
   npm install
   npm run db:push
   npm run dev
   ```

## Deploying to Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. [Import it in Vercel](https://vercel.com/new) — the SvelteKit setup is detected automatically.
3. Set the `DATABASE_URL` environment variable in the Vercel project settings.
4. If you haven't already, run `npm run db:push` once (locally, with the same `DATABASE_URL`) to create the tables.

## How it works

- A group id is a 16-char nanoid (~95 bits of entropy); every API route is scoped under
  `/api/groups/[groupId]/…` and the server verifies each list/item actually belongs to that group.
- Every mutation bumps `groups.version`. Clients poll `GET /api/groups/[groupId]?since=<version>`
  (only while the tab is visible) and get a tiny "unchanged" reply or the full group state.
  Mutations respond with fresh state too, and the UI applies changes optimistically.
- Identity is attribution, not auth: `localStorage` remembers which member of each group this
  browser is. Anyone with the link can claim any name — that's the intended trust model.

Don't keep secrets in a list, and don't post group links publicly.
