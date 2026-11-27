import { createHmac } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '#lib/redis.js';
import { RateLimiter } from '#lib/server/nlt.js';

const lessonStatus = redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'bible:study:lesson-status' });
const local = new RateLimiter([{ max: 6, per: 60_000 }, { max: 60, per: 86_400_000 }]);
const perReader = redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 d'), prefix: 'bible:study:reader' });
const aiGlobal = redis && new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(60, '1 d'), prefix: 'bible:study:ai-total' });
const aiBurst = redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(6, '1 m'), prefix: 'bible:study:ai-burst' });
const discoveryReader = redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 d'), prefix: 'bible:study:discovery' });
const discoveryGlobal = redis && new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(100, '1 d'), prefix: 'bible:study:discovery-total' });
const videoGlobal = redis && new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(200, '1 d'), prefix: 'bible:study:video-total' });
const videoSearchReader = redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 d'), prefix: 'bible:study:video-search-reader' });
const videoSearchGlobal = redis && new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(40, '1 d'), prefix: 'bible:study:video-search-total' });
const paperReader = redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 d'), prefix: 'bible:study:paper-reader' });
const paperGlobal = redis && new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(300, '1 d'), prefix: 'bible:study:paper-total' });

function identifier(address: string): string {
	const day = new Date().toISOString().slice(0, 10);
	const salt = process.env.UPSTASH_REDIS_REST_TOKEN || 'local-study';
	return createHmac('sha256', salt).update(`${day}:${address}`).digest('hex');
}

export type LimitDecision = 'allowed' | 'disabled' | 'rate_limited' | 'failed';

// Upstash returns success=true on its own timeout. That must never authorize paid work.
function decision(result: { success: boolean; reason?: string }): LimitDecision {
	return result.reason === 'timeout' ? 'failed' : result.success ? 'allowed' : 'rate_limited';
}

export async function allowStudy(address: string): Promise<LimitDecision> {
	if (local.take(address) !== 0) return 'rate_limited';
	if (!perReader) return 'allowed';
	try {
		return decision(await perReader.limit(identifier(address)));
	} catch {
		return 'failed';
	}
}

export async function allowAi(): Promise<boolean> {
	if (!aiGlobal || !aiBurst) return false;
	try {
		if (decision(await aiBurst.limit('all')) !== 'allowed') return false;
		return decision(await aiGlobal.limit('all')) === 'allowed';
	} catch { return false; }
}

/** Site-funded search is unavailable unless durable per-reader and global limits are configured. */
export async function allowDiscovery(address: string): Promise<LimitDecision> {
	if (!discoveryReader || !discoveryGlobal) return 'disabled';
	try {
		const id = identifier(address);
		const reader = decision(await discoveryReader.limit(id));
		if (reader !== 'allowed') return reader;
		return decision(await discoveryGlobal.limit('all'));
	} catch {
		return 'failed';
	}
}

export async function allowVideoRefresh(): Promise<boolean> {
	if (!videoGlobal) return false;
	try {
		return decision(await videoGlobal.limit('all')) === 'allowed';
	} catch {
		return false;
	}
}

export async function allowVideoSearch(address: string): Promise<LimitDecision> {
	if (!videoSearchReader || !videoSearchGlobal) return 'disabled';
	try {
		const reader = decision(await videoSearchReader.limit(identifier(address)));
		if (reader !== 'allowed') return reader;
		return decision(await videoSearchGlobal.limit('all'));
	} catch { return 'failed'; }
}

export async function allowPaperSearch(address: string): Promise<LimitDecision> {
	if (!paperReader || !paperGlobal) return 'disabled';
	try {
		const reader = decision(await paperReader.limit(identifier(address)));
		if (reader !== 'allowed') return reader;
		return decision(await paperGlobal.limit('all'));
	} catch { return 'failed'; }
}

/** Status polling has its own durable limit and never spends a generation grant. */
export async function allowLessonStatus(owner: string): Promise<LimitDecision> {
 if (!lessonStatus) return 'disabled';
 try { return decision(await lessonStatus.limit(identifier(owner))); } catch { return 'failed'; }
}
