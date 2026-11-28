import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('#lib/redis.js', () => ({ redis: { get: mocks.get, set: mocks.set } }));
vi.mock('./limits.js', () => ({ allowVideoSearch: vi.fn().mockResolvedValue('disabled') }));
import type { StudyVideo } from '#lib/read/study.js';
import { combinedStatus, discoverSocialShorts, interleave, shortsFromHits, socialShort } from './shorts';

const genesis = { book: 0, chapter: 3, firstVerse: 7, lastVerse: 7 };
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue(null); mocks.set.mockResolvedValue('OK'); });
afterEach(() => vi.unstubAllGlobals());

describe('social short URLs', () => {
	it('accepts TikTok videos and Instagram Reels in canonical form', () => {
		expect(socialShort('https://m.tiktok.com/@bible.daily/video/7312345678901234567?lang=en')).toEqual({ platform: 'tiktok', id: '7312345678901234567', url: 'https://www.tiktok.com/@bible.daily/video/7312345678901234567', author: '@bible.daily' });
		expect(socialShort('https://instagram.com/reels/C1a2b3c4d5/?igsh=x')).toEqual({ platform: 'instagram', id: 'C1a2b3c4d5', url: 'https://www.instagram.com/reel/C1a2b3c4d5/' });
	});
	it('rejects profiles, photo posts, other hosts and plain http', () => {
		for (const url of ['https://www.tiktok.com/@bible.daily', 'https://www.tiktok.com/@a/photo/7312345678901234567', 'https://www.instagram.com/p/C1a2b3c4d5/',
			'https://www.instagram.com/bible.daily/', 'http://www.tiktok.com/@a/video/7312345678901234567', 'https://tiktok.com.evil.test/@a/video/7312345678901234567', 'not a url'])
			expect(socialShort(url)).toBeNull();
	});
});

describe('social short matching', () => {
	it('keeps captions naming the passage, verse matches first, without duplicates', () => {
		const videos = shortsFromHits([
			{ url: 'https://www.instagram.com/reel/C1a2b3c4d5/', title: 'Genesis 3 in 60 seconds' },
			{ url: 'https://www.tiktok.com/@a/video/7312345678901234567', title: 'Their eyes were opened', text: 'Genesis 3:7 explained' },
			{ url: 'https://www.tiktok.com/@a/video/7312345678901234567?is_from_webapp=1', title: 'Genesis 3:7 again' },
			{ url: 'https://www.tiktok.com/@b/video/7399999999999999999', title: 'Genesis 30 story' }
		], genesis);
		expect(videos.map((video) => [video.platform, video.scope, video.channel])).toEqual([['tiktok', 'direct', '@a'], ['instagram', 'context', 'Instagram creator']]);
	});
	it('enriches TikTok results through oEmbed and drops videos it cannot confirm', async () => {
		vi.stubGlobal('fetch', vi.fn(async (url: string) => {
			if (url.startsWith('https://api.exa.ai')) return new Response(JSON.stringify({ results: [
				{ url: 'https://www.tiktok.com/@a/video/7312345678901234567', title: 'Genesis 3:7' },
				{ url: 'https://www.tiktok.com/@gone/video/7300000000000000000', title: 'Genesis 3:7 removed' },
				{ url: 'https://www.instagram.com/reel/C1a2b3c4d5/', title: 'Genesis 3:7 reel' }
			] }));
			if (url.includes('gone')) return new Response('', { status: 404 });
			return new Response(JSON.stringify({ title: 'Eyes opened #Genesis', author_name: 'Bible Daily', thumbnail_url: 'https://p16.tiktokcdn.com/poster.jpg' }));
		}));
		const result = await discoverSocialShorts(genesis, 'exa');
		expect(result.status).toBe('complete');
		expect(result.items.map((video) => [video.platform, video.channel, video.thumbnail])).toEqual([
			['tiktok', 'Bible Daily', 'https://p16.tiktokcdn.com/poster.jpg'], ['instagram', 'Instagram creator', undefined]]);
		expect(mocks.set).toHaveBeenCalledWith(expect.stringContaining('social-shorts'), result.items, { ex: 86_400 });
	});
	it('reports a failed search without caching it', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
		expect(await discoverSocialShorts(genesis, 'exa')).toEqual({ items: [], status: 'failed' });
		expect(mocks.set).not.toHaveBeenCalled();
	});
});

describe('combining platforms', () => {
	it('ignores a disabled search when combining statuses', () => {
		expect(combinedStatus(['disabled', 'disabled'])).toBe('disabled');
		expect(combinedStatus(['disabled', 'complete'])).toBe('complete');
		expect(combinedStatus(['complete', 'failed'])).toBe('partial');
		expect(combinedStatus(['rate_limited', 'disabled'])).toBe('rate_limited');
	});
	it('alternates platforms', () => {
		const v = (id: string) => ({ id }) as StudyVideo;
		expect(interleave([v('y1'), v('y2'), v('y3')], [v('t1')]).map((x) => x.id)).toEqual(['y1', 't1', 'y2', 'y3']);
	});
});
