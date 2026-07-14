import { error } from '@sveltejs/kit';
import type { z } from 'zod';

/** Parse and validate a size-limited JSON request body, throwing 400 on malformed input. */
export async function readJson<Schema extends z.ZodType>(
	request: Request,
	schema: Schema,
	maxBytes?: number
): Promise<z.infer<Schema>> {
	const data = await readLimitedJson(request, maxBytes);
	const result = schema.safeParse(data);
	if (!result.success) {
		throw error(400, 'Invalid request body');
	}
	return result.data;
}

/** Read and parse a JSON body without allowing an unbounded allocation first. */
export async function readLimitedJson(request: Request, maxBytes = 16 * 1024): Promise<unknown> {
	const declaredLength = Number(request.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
		throw error(413, 'Request body is too large');
	}

	const reader = request.body?.getReader();
	if (!reader) throw error(400, 'Missing JSON body');

	const chunks: Uint8Array[] = [];
	let length = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		length += value.byteLength;
		if (length > maxBytes) {
			await reader.cancel();
			throw error(413, 'Request body is too large');
		}
		chunks.push(value);
	}

	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	try {
		return JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		throw error(400, 'Invalid JSON body');
	}
}
