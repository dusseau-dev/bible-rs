import { describe, expect, it } from 'vitest';
import { mergeTestimonials, reviewedTestimonials, testimonialsFromHits } from './community.js';

const genesis = { book: 0, chapter: 3, firstVerse: 7, lastVerse: 7 };

describe('community links', () => {
	it('seeds only the reviewed Genesis range', () => {
		expect(reviewedTestimonials(genesis)).toHaveLength(1);
		expect(reviewedTestimonials({ book: 1, chapter: 3, firstVerse: 7, lastVerse: 7 })).toEqual([]);
	});
	it('allows verified direct and related stories, in that order', () => {
		const hits = [
			{ title: 'My testimony about shame', url: 'https://forums.crosswalk.com/t/my-testimony-about-shame/111', highlights: ['I found forgiveness.'] },
			{ title: 'How I read Genesis 3:7', url: 'https://forums.crosswalk.com/t/how-i-read-genesis/222', highlights: ['Genesis 3:7 mattered to me.'] }
		];
		expect(testimonialsFromHits(hits, genesis).map((x) => x.scope)).toEqual(['direct', 'related']);
	});
	it('rejects off-domain, prayer and debate links, and deduplicates canonical URLs', () => {
		const hits = [
			{ title: 'My testimony about shame', url: 'https://evil.example/t/my-testimony/1', highlights: ['shame'] },
			{ title: 'My prayer request about shame', url: 'https://forums.crosswalk.com/t/prayer/2', highlights: ['shame'] },
			{ title: 'My testimony about shame', url: 'https://forums.crosswalk.com/t/my-testimony/3?x=1', highlights: ['shame'] },
			{ title: 'My testimony about shame', url: 'https://forums.crosswalk.com/t/my-testimony/3?x=2', highlights: ['shame'] }
		];
		expect(testimonialsFromHits(hits, genesis)).toHaveLength(1);
		expect(mergeTestimonials(reviewedTestimonials(genesis), testimonialsFromHits(hits, genesis))).toHaveLength(2);
	});
	it('omits crisis stories even when a theme matches', () => {
		const hits = [{ title: 'My testimony about shame', url: 'https://forums.crosswalk.com/t/my-testimony/4', highlights: ['I was homeless and ashamed.'] }];
		expect(testimonialsFromHits(hits, genesis)).toEqual([]);
	});
	it('does not treat a longer verse number as an exact passage match', () => {
		const hits = [{ title: 'My testimony about Genesis 3:70 and shame', url: 'https://forums.crosswalk.com/t/my-testimony/5', highlights: ['Genesis 3:70'] }];
		expect(testimonialsFromHits(hits, genesis)[0]?.scope).toBe('related');
	});
});
