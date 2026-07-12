import { error } from '@sveltejs/kit';
import type { z } from 'zod';

/** Parse and validate a JSON request body, throwing 400 on malformed input. */
export async function readJson<Schema extends z.ZodType>(
	request: Request,
	schema: Schema
): Promise<z.infer<Schema>> {
	let data: unknown;
	try {
		data = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	const result = schema.safeParse(data);
	if (!result.success) {
		throw error(400, 'Invalid request body');
	}
	return result.data;
}
