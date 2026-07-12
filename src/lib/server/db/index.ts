import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

type Db = NeonHttpDatabase<typeof schema>;

let instance: Db | null = null;

function connect(): Db {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
	return drizzle(neon(env.DATABASE_URL), { schema });
}

// Lazy: SvelteKit's build-time analysis imports this module without a database
// configured; only actual queries need the connection.
export const db = new Proxy({} as Db, {
	get(_, prop) {
		instance ??= connect();
		const value = Reflect.get(instance, prop, instance);
		return typeof value === 'function' ? value.bind(instance) : value;
	}
});
