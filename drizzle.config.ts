import { defineConfig } from 'drizzle-kit';

const key = process.env.DB_TARGET === 'prod' ? 'DATABASE_URL_PROD' : 'DATABASE_URL';
const url = process.env[key];
if (!url) throw new Error(`${key} is not set`);

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url },
	verbose: true
});
