import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL;

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	// `generate` only needs the schema. Commands that connect to Postgres
	// (`push`, `migrate`, and `studio`) also require DATABASE_URL.
	...(url ? { dbCredentials: { url } } : {}),
	verbose: true
});
