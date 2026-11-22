import { createHmac } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { RateLimiter } from '#lib/server/nlt.js';

const local = new RateLimiter([{ max: 6, per: 60_000 }, { max: 60, per: 86_400_000 }]);
const configured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = configured ? Redis.fromEnv() : null;
const perReader = redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 d'), prefix: 'bible:study:reader' });
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

export async function allowStudy(address: string): Promise<boolean> {
	if (!perReader) return local.take(address) === 0;
	try {
		return (await perReader.limit(identifier(address))).success;
	} catch {
		return false;
	}
}

/** Site-funded search is unavailable unless durable per-reader and global limits are configured. */
export async function allowDiscovery(address: string): Promise<boolean> {
	if (!discoveryReader || !discoveryGlobal) return false;
	try {
		const id = identifier(address);
		if (!(await discoveryReader.limit(id)).success) return false;
		return (await discoveryGlobal.limit('all')).success;
	} catch {
		return false;
	}
}

export async function allowVideoRefresh(): Promise<boolean> {
	if (!videoGlobal) return false;
	try {
		return (await videoGlobal.limit('all')).success;
	} catch {
		return false;
	}
}

export async function allowVideoSearch(address: string): Promise<boolean> {
	if (!videoSearchReader || !videoSearchGlobal) return false;
	try {
		if (!(await videoSearchReader.limit(identifier(address))).success) return false;
		return (await videoSearchGlobal.limit('all')).success;
	} catch { return false; }
}

export async function allowPaperSearch(address: string): Promise<boolean> {
	if (!paperReader || !paperGlobal) return false;
	try {
		if (!(await paperReader.limit(identifier(address))).success) return false;
		return (await paperGlobal.limit('all')).success;
	} catch { return false; }
}
