import { redis } from '#lib/redis.js';
import { BOOKS } from '#lib/read/books.js';
import type { DiscoveryResult, EvidenceScope, StudyPassage, StudyVideo } from '#lib/read/study.js';
import { allowVideoSearch } from './limits.js';

const CACHE_SECONDS = 7 * 24 * 60 * 60;
/** YouTube Shorts run up to three minutes. */
export const MAX_SHORT_SECONDS = 180;

export interface YouTubeItem {
	id?: string;
	snippet?: { title?: string; description?: string; channelTitle?: string };
	contentDetails?: { duration?: string };
	status?: { privacyStatus?: string };
	/** Returned only when the request sets maxHeight; int64 values may arrive as strings. */
	player?: { embedWidth?: number | string; embedHeight?: number | string };
}

export function durationSeconds(value: string | undefined): number | null {
	const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? '');
	if (!match || !match.slice(1).some(Boolean)) return null;
	return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `direct` when text names a verse in the passage, `context` when it names only the chapter, otherwise null. */
export function passageScope(p: StudyPassage): (text: string) => Exclude<EvidenceScope, 'related'> | null {
	const book = BOOKS[p.book].name === 'Psalms' ? 'Psalms?' : escape(BOOKS[p.book].name);
	const chapter = new RegExp(`\\b${book}\\s+${p.chapter}(?!\\d)`, 'i');
	const verses = Array.from({ length: p.lastVerse - p.firstVerse + 1 }, (_, i) =>
		new RegExp(`\\b${book}\\s+${p.chapter}:${p.firstVerse + i}(?!\\d)`, 'i'));
	return (text) => !chapter.test(text) ? null : verses.some((verse) => verse.test(text)) ? 'direct' : 'context';
}

/** A public, vertical clip of three minutes or less. */
export function isShort(item: YouTubeItem): boolean {
	const duration = durationSeconds(item.contentDetails?.duration);
	const width = Number(item.player?.embedWidth), height = Number(item.player?.embedHeight);
	return item.status?.privacyStatus === 'public' && !!duration && duration >= 5 && duration <= MAX_SHORT_SECONDS && height > width;
}

export const shortsUrl = (id: string) => `https://www.youtube.com/shorts/${id}`;

/** Metadata only. A title or description must identify the passage's chapter. */
export function videosFromYoutube(items: YouTubeItem[], p: StudyPassage): StudyVideo[] {
	const scopeOf = passageScope(p);
	const seen = new Set<string>();
	return items.flatMap((item) => {
		if (!item.id || !/^[A-Za-z0-9_-]{11}$/.test(item.id) || seen.has(item.id) || !isShort(item)) return [];
		const title = item.snippet?.title?.trim().slice(0, 180);
		const scope = scopeOf(`${title} ${item.snippet?.description || ''}`);
		if (!title || !scope) return [];
		seen.add(item.id);
		return [{
			id: item.id, platform: 'youtube' as const, title, channel: item.snippet?.channelTitle?.trim().slice(0, 100) || 'YouTube channel',
			url: shortsUrl(item.id), scope, verification: 'video link only' as const,
			durationSeconds: durationSeconds(item.contentDetails?.duration)!, reviewed: false
		}];
	}).sort((a, b) => Number(b.scope === 'direct') - Number(a.scope === 'direct'));
}

export function mergeVideos(reviewed: StudyVideo[], discovered: StudyVideo[]): StudyVideo[] {
	const seen = new Set<string>();
	return [...reviewed.map((video) => ({ ...video, reviewed: true })), ...discovered].filter((video) => {
		const key = `${video.platform}:${video.id}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	}).sort((a, b) => Number(b.scope === 'direct') - Number(a.scope === 'direct') || Number(Boolean(b.reviewed)) - Number(Boolean(a.reviewed))).slice(0, 10);
}

async function searchIds(query: string, key: string): Promise<string[]> {
	const url = new URL('https://www.googleapis.com/youtube/v3/search');
	url.searchParams.set('part', 'snippet');
	url.searchParams.set('type', 'video');
	url.searchParams.set('q', query);
	url.searchParams.set('videoDuration', 'short');
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

/** Snippet, duration, privacy and player size; the player size tells vertical Shorts from landscape clips. */
export async function youtubeDetails(ids: string[], key: string, signal = AbortSignal.timeout(7_000)): Promise<YouTubeItem[]> {
	if (!ids.length) return [];
	const url = new URL('https://www.googleapis.com/youtube/v3/videos');
	url.searchParams.set('part', 'snippet,contentDetails,status,player');
	url.searchParams.set('maxHeight', '640');
	url.searchParams.set('id', ids.slice(0, 50).join(','));
	url.searchParams.set('key', key);
	const response = await fetch(url, { signal });
	if (!response.ok) throw new Error(`YouTube details ${response.status}`);
	return (await response.json() as { items?: YouTubeItem[] }).items ?? [];
}

/** Two capped Shorts searches, one for the verse and one for the chapter; cached per passage for seven days. */
export async function discoverPassageVideos(p: StudyPassage, key: string | undefined, client: string): Promise<DiscoveryResult<StudyVideo>> {
	if (!key || !redis) return { items: [], status: 'disabled' };
	const cacheKey = `bible:study:youtube:shorts:v1:${p.book}:${p.chapter}:${p.firstVerse}:${p.lastVerse}`;
	try { const cached = await redis.get<StudyVideo[]>(cacheKey); if (cached) return { items: cached, status: 'complete' }; }
	catch { /* Search can still proceed. */ }
	const permission = await allowVideoSearch(client);
	if (permission !== 'allowed') return { items: [], status: permission };
	const book = BOOKS[p.book].name;
	try {
		const searches = await Promise.allSettled([searchIds(`${book} ${p.chapter}:${p.firstVerse} #shorts`, key), searchIds(`${book} ${p.chapter} #shorts`, key)]);
		if (searches.every(r => r.status === 'rejected')) return { items: [], status: 'failed' };
		const partial = searches.some(r => r.status === 'rejected');
		const ids = [...new Set(searches.flatMap((result) => result.status === 'fulfilled' ? result.value : []))];
		const selected = videosFromYoutube(await youtubeDetails(ids, key), p).slice(0, 8);
		if (!partial) try { await redis.set(cacheKey, selected, { ex: CACHE_SECONDS }); } catch { /* Search results still work. */ }
		return { items: selected, status: partial ? 'partial' : 'complete' };
	} catch { return { items: [], status: 'failed' }; }
}
