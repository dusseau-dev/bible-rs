import { describe, expect, it } from 'vitest';
import { durationSeconds, mergeVideos, videosFromYoutube } from './youtube.js';

const genesis = { book: 0, chapter: 3, firstVerse: 7, lastVerse: 7 };

describe('YouTube passage metadata', () => {
	it('parses duration for short and full videos', () => {
		expect(durationSeconds('PT2M30S')).toBe(150);
		expect(durationSeconds('PT1H2M3S')).toBe(3723);
		expect(durationSeconds('bad')).toBeNull();
	});
	it('labels exact passage clips and chapter context separately', () => {
		const videos = videosFromYoutube([
			{ id: 'abcdefghijk', snippet: { title: 'Genesis 3:7 explained', channelTitle: 'Example' }, contentDetails: { duration: 'PT2M' }, status: { privacyStatus: 'public' } },
			{ id: 'lmnopqrstuv', snippet: { title: 'Genesis 3 study', channelTitle: 'Example' }, contentDetails: { duration: 'PT34M' }, status: { privacyStatus: 'public' } },
			{ id: '12345678901', snippet: { title: 'Genesis 30 story' }, contentDetails: { duration: 'PT25M' }, status: { privacyStatus: 'public' } }
		], genesis);
		expect(videos.map((video) => [video.scope, video.format])).toEqual([['direct', 'short'], ['context', 'full']]);
	});
	it('keeps reviewed links when discovery duplicates an ID', () => {
		const reviewed = { id: 'abcdefghijk', title: 'Reviewed', channel: 'Example', url: 'https://www.youtube.com/watch?v=abcdefghijk', scope: 'direct' as const, verification: 'video link only' as const };
		expect(mergeVideos([reviewed], [{ ...reviewed, title: 'Search result' }])[0].title).toBe('Reviewed');
	});
});
