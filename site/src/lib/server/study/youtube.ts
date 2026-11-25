import { redis } from '#lib/redis.js';
import { BOOKS } from '#lib/read/books.js';
import type { DiscoveryResult, StudyPassage, StudyVideo } from '#lib/read/study.js';
import { allowVideoSearch } from './limits.js';

const CACHE_SECONDS = 7 * 24 * 60 * 60;

export interface YouTubeItem {
	id?: string;
	snippet?: { title?: string; description?: string; channelTitle?: string };
	contentDetails?: { duration?: string };
	status?: { privacyStatus?: string };
}

export function durationSeconds(value: string | undefined): number | null {
	const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? '');
	if (!match || !match.slice(1).some(Boolean)) return null;
	return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Metadata only. A title or description must identify the passage's chapter. */
export function videosFromYoutube(items: YouTubeItem[], p: StudyPassage): StudyVideo[] {
	const book = BOOKS[p.book].name === 'Psalms' ? 'Psalms?' : escape(BOOKS[p.book].name);
	const chapter = new RegExp(`\\b${book}\\s+${p.chapter}(?!\\d)`, 'i');
	const verses = Array.from({ length: p.lastVerse - p.firstVerse + 1 }, (_, i) =>
		new RegExp(`\\b${book}\\s+${p.chapter}:${p.firstVerse + i}(?!\\d)`, 'i'));
	const seen = new Set<string>();
	return items.flatMap((item) => {
		if (!item.id || !/^[A-Za-z0-9_-]{11}$/.test(item.id) || seen.has(item.id) || item.status?.privacyStatus !== 'public') return [];
		const title = item.snippet?.title?.trim().slice(0, 180);
		const duration = durationSeconds(item.contentDetails?.duration);
		if (!title || !duration || duration < 15) return [];
		const text = `${title} ${item.snippet?.description || ''}`;
		if (!chapter.test(text)) return [];
		seen.add(item.id);
		return [{
			id: item.id, title, channel: item.snippet?.channelTitle?.trim().slice(0, 100) || 'YouTube channel',
			url: `https://www.youtube.com/watch?v=${item.id}`, scope: verses.some((verse) => verse.test(text)) ? 'direct' as const : 'context' as const,
			verification: 'video link only' as const, durationSeconds: duration,
			format: duration < 240 ? 'short' as const : 'full' as const, reviewed: false
		}];
	}).sort((a, b) => Number(b.scope === 'direct') - Number(a.scope === 'direct'));
}

export function mergeVideos(reviewed: StudyVideo[], discovered: StudyVideo[]): StudyVideo[] {
	const seen = new Set<string>();
	return [...reviewed.map((video) => ({ ...video, reviewed: true })), ...discovered].filter((video) => {
		if (seen.has(video.id)) return false;
		seen.add(video.id);
		return true;
	}).sort((a, b) => Number(b.scope === 'direct') - Number(a.scope === 'direct') || Number(Boolean(b.reviewed)) - Number(Boolean(a.reviewed))).slice(0, 12);
}

async function searchIds(p: StudyPassage, key: string, duration: 'any' | 'short'): Promise<string[]> {
	const url = new URL('https://www.googleapis.com/youtube/v3/search');
	url.searchParams.set('part', 'snippet');
	url.searchParams.set('type', 'video');
	url.searchParams.set('q', duration === 'short'
		? `${BOOKS[p.book].name} ${p.chapter}:${p.firstVerse} Bible`
		: `${BOOKS[p.book].name} ${p.chapter} Bible teaching`);
	url.searchParams.set('videoDuration', duration);
	url.searchParams.set('videoEmbeddable', 'true');
	url.searchParams.set('safeSearch', 'strict');
	url.searchParams.set('relevanceLanguage', 'en');
	url.searchParams.set('maxResults', '15');
	url.searchParams.set('key', key);
	const response = await fetch(url, { signal: AbortSignal.timeout(7_000) });
	if (!response.ok) throw new Error(`YouTube search ${response.status}`);
	const body = await response.json() as { items?: Array<{ id?: { videoId?: string } }> };
	return (body.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));
}

async function details(ids: string[], key: string): Promise<YouTubeItem[]> {
	if (!ids.length) return [];
	const url = new URL('https://www.googleapis.com/youtube/v3/videos');
	url.searchParams.set('part', 'snippet,contentDetails,status');
	url.searchParams.set('id', ids.slice(0, 30).join(','));
	url.searchParams.set('key', key);
	const response = await fetch(url, { signal: AbortSignal.timeout(7_000) });
	if (!response.ok) throw new Error(`YouTube details ${response.status}`);
	return (await response.json() as { items?: YouTubeItem[] }).items ?? [];
}

/** Two capped searches cover short clips and full videos; cached per passage for seven days. */
export async function discoverPassageVideos(p: StudyPassage, key: string | undefined, client: string): Promise<DiscoveryResult<StudyVideo>> {
	if (!key || !redis) return { items: [], status: 'disabled' };
	const cacheKey = `bible:study:youtube:${p.book}:${p.chapter}:${p.firstVerse}:${p.lastVerse}`;
	try { const cached = await redis.get<StudyVideo[]>(cacheKey); if (cached) return { items: cached, status: 'complete' }; }
	catch { /* Search can still proceed. */ }
	const permission = await allowVideoSearch(client);
	if (permission !== 'allowed') return { items: [], status: permission };
	try {
		const searches = await Promise.allSettled([searchIds(p, key, 'any'), searchIds(p, key, 'short')]);
		if (searches.every(r => r.status === 'rejected')) return { items: [], status: 'failed' };
		const partial = searches.some(r => r.status === 'rejected');
		const ids = [...new Set(searches.flatMap((result) => result.status === 'fulfilled' ? result.value : []))];
		const found = videosFromYoutube(await details(ids, key), p);
		const selected = [...found.filter((video) => video.format === 'short').slice(0, 4), ...found.filter((video) => video.format === 'full').slice(0, 6)];
		if (!partial) try { await redis.set(cacheKey, selected, { ex: CACHE_SECONDS }); } catch { /* Search results still work. */ }
		return { items: selected, status: partial ? 'partial' : 'complete' };
	} catch { return { items: [], status: 'failed' }; }
}
