import { describe, expect, it } from 'vitest';
import { durationSeconds, mergeVideos, videosFromYoutube } from './youtube.js';

const genesis = { book: 0, chapter: 3, firstVerse: 7, lastVerse: 7 };

describe('YouTube passage metadata', () => {
	it('parses duration for short and full videos', () => {
		expect(durationSeconds('PT2M30S')).toBe(150);
		expect(durationSeconds('PT1H2M3S')).toBe(3723);
		expect(durationSeconds('bad')).toBeNull();
	});
	const vertical = { embedWidth: '360', embedHeight: '640' };
	const item = (id: string, title: string, duration: string, player: { embedWidth?: number | string; embedHeight?: number | string } = vertical) =>
		({ id, snippet: { title, channelTitle: 'Example' }, contentDetails: { duration }, status: { privacyStatus: 'public' }, player });
	it('keeps only vertical clips of three minutes or less, linking to the Shorts player', () => {
		const videos = videosFromYoutube([
			item('abcdefghijk', 'Genesis 3:7 explained', 'PT2M'),
			item('lmnopqrstuv', 'Genesis 3 study', 'PT3M'),
			item('wide0000001', 'Genesis 3:7 landscape clip', 'PT1M', { embedWidth: 640, embedHeight: 360 }),
			item('long0000001', 'Genesis 3:7 sermon', 'PT3M1S'),
			item('nosize00001', 'Genesis 3:7 unknown size', 'PT1M', {}),
			item('12345678901', 'Genesis 30 story', 'PT1M')
		], genesis);
		expect(videos.map((video) => [video.id, video.scope, video.platform])).toEqual([['abcdefghijk', 'direct', 'youtube'], ['lmnopqrstuv', 'context', 'youtube']]);
		expect(videos[0].url).toBe('https://www.youtube.com/shorts/abcdefghijk');
	});
	it('keeps reviewed links when discovery duplicates an ID', () => {
		const reviewed = { id: 'abcdefghijk', platform: 'youtube' as const, title: 'Reviewed', channel: 'Example', url: 'https://www.youtube.com/shorts/abcdefghijk', scope: 'direct' as const, verification: 'video link only' as const };
		expect(mergeVideos([reviewed], [{ ...reviewed, title: 'Search result' }])[0].title).toBe('Reviewed');
	});
});
