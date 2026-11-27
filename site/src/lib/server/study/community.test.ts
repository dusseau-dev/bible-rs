import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ redis: null as null | { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> } }));
vi.mock('#lib/redis.js', () => ({ get redis() { return store.redis; } }));
vi.mock('./answer.js', () => ({ requestJson: vi.fn() }));
import { requestJson } from './answer.js';
import { diversify, discoverTestimonials, mergeTestimonials, platformFor, reviewedTestimonials, testimonialQuery, testimonialsFromHits } from './community.js';

const genesis = { book: 0, chapter: 3, firstVerse: 7, lastVerse: 7 };
const john = { book: 42, chapter: 3, firstVerse: 16, lastVerse: 16 };
const story = 'I was lost for years and my life changed when I finally read this verse for myself.';

describe('platformFor', () => {
	it('accepts individual posts on every supported platform', () => {
		const urls = {
			x: 'https://twitter.com/someone/status/1234567890',
			reddit: 'https://old.reddit.com/r/Christianity/comments/abc123/my_testimony/',
			facebook: 'https://www.facebook.com/groups/faith/posts/123456',
			linkedin: 'https://www.linkedin.com/posts/jane-doe_faith-activity-7123',
			threads: 'https://www.threads.net/@jane.doe/post/DIBvJFhshj3',
			instagram: 'https://www.instagram.com/reel/Cxyz_123/',
			youtube: 'https://www.youtube.com/shorts/ZRyoxy_KTsw?feature=share',
			crosswalk: 'https://forums.crosswalk.com/t/my-testimony/21578'
		};
		for (const [platform, url] of Object.entries(urls)) expect(platformFor(url)?.platform).toBe(platform);
	});
	it('canonicalises hosts and strips query strings', () => {
		expect(platformFor('https://twitter.com/someone/status/1?s=20')?.canonical).toBe('https://x.com/someone/status/1');
		expect(platformFor('https://threads.net/@a/post/B')?.canonical).toBe('https://www.threads.com/@a/post/B');
		expect(platformFor('https://twitter.com/someone/status/1')?.author).toBe('@someone');
	});
	it('rejects profiles, articles, spoofed hosts, plain http, and regular YouTube videos', () => {
		for (const url of [
			'https://x.com/someone', 'https://www.linkedin.com/in/jane-doe', 'https://www.linkedin.com/pulse/some-article',
			'https://reddit.com.evil.example/r/a/comments/b/c', 'http://www.reddit.com/r/a/comments/b1/c',
			'https://www.youtube.com/watch?v=ZRyoxy_KTsw', 'https://www.instagram.com/jane.doe/', 'not a url'
		]) expect(platformFor(url)).toBeNull();
	});
});

describe('testimonialsFromHits', () => {
	it('keeps first-person posts with a quote, and ranks exact-verse stories first', () => {
		const items = testimonialsFromHits([
			{ title: 'A post', url: 'https://www.threads.com/@a/post/A1', highlights: [story] },
			{ title: 'John 3:16', url: 'https://www.youtube.com/shorts/abcdefghijk', highlights: [`John 3:16 saved me. ${story}`] }
		], john);
		expect(items.map((x) => [x.platform, x.scope])).toEqual([['youtube', 'direct'], ['threads', 'related']]);
		expect(items[1]).toMatchObject({ excerpt: story, author: '@a' });
	});
	it('drops third-person teaching, crisis stories, prayer requests, and duplicates', () => {
		const items = testimonialsFromHits([
			{ title: 'Lesson', url: 'https://www.threads.com/@a/post/A1', highlights: ['God so loved the world that He gave His only Son, the verse teaches.'] },
			{ title: 'Story', url: 'https://www.threads.com/@a/post/A2', highlights: [`${story} I was homeless then.`] },
			{ title: 'My prayer request', url: 'https://www.threads.com/@a/post/A3', highlights: [story] },
			{ title: 'Story', url: 'https://twitter.com/b/status/9', highlights: [story] },
			{ title: 'Story', url: 'https://x.com/b/status/9?s=1', highlights: [story] }
		], john);
		expect(items.map((x) => x.url)).toEqual(['https://x.com/b/status/9']);
	});
	it('removes LinkedIn page metadata from the quote', () => {
		const [item] = testimonialsFromHits([{ title: 'Post', url: 'https://www.linkedin.com/posts/jane_x-activity-1', highlights: ['# Found | Jane Doe · LinkedIn · 2025-09-02\n\n**Jane Doe**: Head of Sales\n\n---\n\nI was only 13 when He found me and my life changed.', 'He found me in 2004. Jane Doe · LinkedIn · 2025-09-02T00:00:00+00:00'] }], john);
		expect(item.excerpt).toBe('I was only 13 when He found me and my life changed. … He found me in 2004.');
	});
	it('does not treat a longer verse number as an exact match', () => {
		const [item] = testimonialsFromHits([{ title: 'Genesis 3:70', url: 'https://www.threads.com/@a/post/A1', highlights: [`Genesis 3:70 ${story}`] }], genesis);
		expect(item.scope).toBe('related');
		expect(item.theme).toBe('Genesis 3');
	});
});

describe('selection', () => {
	it('takes at most two per platform before filling remaining slots', () => {
		const make = (platform: 'linkedin' | 'threads', n: number) => ({ id: `${platform}${n}`, title: '', author: '', url: `${platform}${n}`, scope: 'related' as const, platform });
		const items = [1, 2, 3, 4].map((n) => make('linkedin', n)).concat([make('threads', 1)]);
		expect(diversify(items, 3).map((x) => x.id)).toEqual(['linkedin1', 'linkedin2', 'threads1']);
	});
	it('keeps the reviewed Genesis seed and deduplicates merged stories', () => {
		expect(reviewedTestimonials(genesis)[0].platform).toBe('crosswalk');
		expect(reviewedTestimonials(john)).toEqual([]);
		expect(mergeTestimonials(reviewedTestimonials(genesis), reviewedTestimonials(genesis))).toHaveLength(1);
	});
	it('quotes the opening words of the passage in the search', () => {
		expect(testimonialQuery(john, '16 For God so loved the world')).toBe('personal testimony: how John 3:16 ("For God so loved the world") changed my life');
	});
});

describe('discoverTestimonials', () => {
	const hit = { title: 'Post', url: 'https://www.threads.com/@a/post/A1', highlights: [story] };
	const exa = (results: unknown[]) => vi.fn().mockImplementation(async () => new Response(JSON.stringify({ results })));
	beforeEach(() => { store.redis = { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') }; });
	afterEach(() => { vi.unstubAllGlobals(); vi.mocked(requestJson).mockReset(); store.redis = null; });

	it('serves the cache without searching, even when the reader is rate limited', async () => {
		store.redis!.get.mockResolvedValue([{ id: 'cached' }]);
		const fetch = exa([hit]); vi.stubGlobal('fetch', fetch);
		expect(await discoverTestimonials(john, '', 'key', 'rate_limited')).toEqual({ items: [{ id: 'cached' }], status: 'complete' });
		expect(fetch).not.toHaveBeenCalled();
	});
	it('reports the limit on a cache miss', async () => {
		vi.stubGlobal('fetch', exa([hit]));
		expect(await discoverTestimonials(john, '', 'key', 'rate_limited')).toEqual({ items: [], status: 'rate_limited' });
	});
	it('searches each platform group, then caches the result', async () => {
		const fetch = exa([hit]); vi.stubGlobal('fetch', fetch);
		const result = await discoverTestimonials(john, '', 'key', 'allowed');
		expect(fetch).toHaveBeenCalledTimes(3);
		expect(result.items).toHaveLength(1);
		expect(store.redis!.set).toHaveBeenCalledOnce();
	});
	it('drops posts the AI reviewer rejects, and falls back to heuristics when it fails', async () => {
		vi.stubGlobal('fetch', exa([hit]));
		vi.mocked(requestJson).mockResolvedValueOnce({ assessments: [{ index: 0, keep: false, relevance: 'general' }] });
		expect((await discoverTestimonials(john, '', 'key', 'allowed', 'ai')).items).toEqual([]);
		vi.mocked(requestJson).mockRejectedValueOnce(new Error('down'));
		expect((await discoverTestimonials(john, '', 'key', 'allowed', 'ai')).items).toHaveLength(1);
	});
	it('reports failure when every search fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('', { status: 500 })));
		expect(await discoverTestimonials(john, '', 'key', 'allowed')).toEqual({ items: [], status: 'failed' });
	});
});

describe('reviewTestimonials', () => {
	it('orders kept stories by how closely they relate to the passage', async () => {
		const items = ['a', 'b', 'c'].map((id) => ({ id, title: id, author: '', url: id, scope: 'related' as const, excerpt: story }));
		vi.mocked(requestJson).mockResolvedValueOnce({ assessments: [{ index: 0, keep: true, relevance: 'general' }, { index: 1, keep: false, relevance: 'general' }, { index: 2, keep: true, relevance: 'passage' }] });
		const { reviewTestimonials } = await import('./community.js');
		expect((await reviewTestimonials(items, 'John 3:16', 'ai'))?.map((x) => x.id)).toEqual(['c', 'a']);
	});
});
