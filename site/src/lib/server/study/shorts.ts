import { redis } from '#lib/redis.js';
import { BOOKS } from '#lib/read/books.js';
import type { DiscoveryResult, DiscoveryStatus, StudyPassage, StudyVideo } from '#lib/read/study.js';
import { discoverPassageVideos, passageScope } from './youtube.js';

/** TikTok thumbnail URLs are signed and expire, so social results are cached for a day, not a week. */
const CACHE_SECONDS = 24 * 60 * 60;

interface ExaHit { url?: string; title?: string; author?: string; text?: string }
type Social = { platform: 'tiktok' | 'instagram'; id: string; url: string; author?: string };

/** A TikTok video or Instagram Reel page, in canonical form. Profiles, photos and posts are rejected. */
export function socialShort(raw: string): Social | null {
	let url: URL;
	try { url = new URL(raw); } catch { return null; }
	if (url.protocol !== 'https:') return null;
	const host = url.hostname.replace(/^(www|m)\./, '');
	if (host === 'tiktok.com') {
		const m = /^\/@([\w.]{1,40})\/video\/(\d{15,22})\/?$/.exec(url.pathname);
		return m ? { platform: 'tiktok', id: m[2], url: `https://www.tiktok.com/@${m[1]}/video/${m[2]}`, author: `@${m[1]}` } : null;
	}
	if (host === 'instagram.com') {
		const m = /^\/reels?\/([\w-]{5,40})\/?$/.exec(url.pathname);
		return m ? { platform: 'instagram', id: m[1], url: `https://www.instagram.com/reel/${m[1]}/` } : null;
	}
	return null;
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Heuristic pass: a short-video page whose caption names the passage's chapter. */
export function shortsFromHits(hits: ExaHit[], p: StudyPassage): StudyVideo[] {
	const scopeOf = passageScope(p);
	const seen = new Set<string>();
	return hits.flatMap((hit) => {
		const found = hit.url ? socialShort(hit.url) : null;
		const key = found && `${found.platform}:${found.id}`;
		if (!found || seen.has(key!)) return [];
		const title = clean(hit.title ?? '').slice(0, 180);
		const scope = scopeOf(`${title} ${hit.text ?? ''}`);
		if (!title || !scope) return [];
		seen.add(key!);
		return [{
			id: found.id, platform: found.platform, title, scope, url: found.url, verification: 'video link only' as const, reviewed: false,
			channel: clean(hit.author ?? '').slice(0, 100) || found.author || (found.platform === 'tiktok' ? 'TikTok creator' : 'Instagram creator')
		}];
	}).sort((a, b) => Number(b.scope === 'direct') - Number(a.scope === 'direct'));
}

/** TikTok's public oEmbed confirms the video is still public and supplies its caption, creator and poster. */
async function withTikTokEmbed(video: StudyVideo): Promise<StudyVideo | null> {
	if (video.platform !== 'tiktok') return video;
	try {
		const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(video.url)}`, { signal: AbortSignal.timeout(5_000) });
		if (!response.ok) return null;
		const body = await response.json() as { title?: string; author_name?: string; thumbnail_url?: string };
		const thumbnail = body.thumbnail_url?.startsWith('https://') ? body.thumbnail_url : undefined;
		return { ...video, title: clean(body.title ?? '').slice(0, 180) || video.title, channel: clean(body.author_name ?? '').slice(0, 100) || video.channel, ...(thumbnail ? { thumbnail } : {}) };
	} catch { return null; }
}

export async function discoverSocialShorts(p: StudyPassage, key: string): Promise<DiscoveryResult<StudyVideo>> {
	const cacheKey = `bible:study:social-shorts:v1:${p.book}:${p.chapter}:${p.firstVerse}:${p.lastVerse}`;
	if (redis) try { const cached = await redis.get<StudyVideo[]>(cacheKey); if (cached) return { items: cached, status: 'complete' }; }
	catch { /* Search can still proceed. */ }
	try {
		const response = await fetch('https://api.exa.ai/search', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-api-key': key },
			body: JSON.stringify({
				query: `${BOOKS[p.book].name} ${p.chapter}:${p.firstVerse} Bible verse short video`, type: 'auto', numResults: 20, moderation: true,
				includeDomains: ['tiktok.com', 'instagram.com'], contents: { text: { maxCharacters: 500 } }
			}),
			signal: AbortSignal.timeout(10_000)
		});
		if (!response.ok) return { items: [], status: 'failed' };
		const hits = (await response.json() as { results?: ExaHit[] }).results ?? [];
		const checked = await Promise.all(shortsFromHits(hits, p).slice(0, 8).map(withTikTokEmbed));
		const items = checked.filter((video): video is StudyVideo => video !== null).slice(0, 6);
		if (redis) try { await redis.set(cacheKey, items, { ex: CACHE_SECONDS }); } catch { /* Search results still work. */ }
		return { items, status: 'complete' };
	} catch { return { items: [], status: 'failed' }; }
}

/** One status for both searches: a search that is switched off does not count against the other. */
export function combinedStatus(statuses: DiscoveryStatus[]): DiscoveryStatus {
	const active = statuses.filter((status) => status !== 'disabled');
	if (!active.length) return 'disabled';
	if (active.every((status) => status === 'complete')) return 'complete';
	if (active.some((status) => status === 'complete' || status === 'partial')) return 'partial';
	return active[0];
}

/** Alternates platforms so one cannot take every slot near the top. */
export function interleave(...lists: StudyVideo[][]): StudyVideo[] {
	return Array.from({ length: Math.max(0, ...lists.map((list) => list.length)) }, (_, i) => lists.flatMap((list) => list[i] ?? [])).flat();
}

/** YouTube Shorts through the YouTube Data API, TikTok and Instagram Reels through Exa when the reader may search it. */
export async function discoverShorts(p: StudyPassage, youtubeKey: string | undefined, client: string, exaKey?: string): Promise<DiscoveryResult<StudyVideo>> {
	const [youtube, social] = await Promise.all([
		discoverPassageVideos(p, youtubeKey, client),
		exaKey ? discoverSocialShorts(p, exaKey) : Promise.resolve<DiscoveryResult<StudyVideo>>({ items: [], status: 'disabled' })
	]);
	return { items: interleave(youtube.items, social.items), status: combinedStatus([youtube.status, social.status]) };
}
