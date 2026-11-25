/** Bound the actual streamed body, including chunked requests, before parsing. */
export async function readBody(request: Request, limit: number): Promise<string | null> {
	const reader = request.body?.getReader();
	if (!reader) return '';
	const chunks: Uint8Array[] = [];
	let length = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			length += value.byteLength;
			if (length > limit) { await reader.cancel(); return null; }
			chunks.push(value);
		}
		return Buffer.concat(chunks).toString('utf8');
	} finally { reader.releaseLock(); }
}
