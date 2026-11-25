import { Redis } from '@upstash/redis';
import { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } from '$app/env/private';

/** Missing/malformed optional configuration must not crash module imports. Auth fails closed. */
function configuredClient(): Redis | null {
	const token = UPSTASH_REDIS_REST_TOKEN?.trim();
	try {
		const url = new URL(UPSTASH_REDIS_REST_URL?.trim() ?? '');
		if (url.protocol !== 'https:' || url.username || url.password || !token || token === '...') return null;
		return new Redis({ url: url.toString(), token, retry: false, signal: () => AbortSignal.timeout(4000) });
	} catch { return null; }
}
export const redis = configuredClient();
