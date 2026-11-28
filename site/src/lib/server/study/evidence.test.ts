import { describe, expect, it } from 'vitest';
import { bookContextNotes, localEvidence, noteReferences, passageFrom, passageVideos } from './evidence';

describe('passage study evidence', () => {
	it('rejects invalid and overlong selections', () => {
		expect(passageFrom({ book: 42, chapter: 3, firstVerse: 16, lastVerse: 16 })).toEqual({ book: 42, chapter: 3, firstVerse: 16, lastVerse: 16 });
		expect(passageFrom({ book: 42, chapter: 3, firstVerse: 16, lastVerse: 46 })).toBeNull();
		expect(passageFrom({ book: 99, chapter: 1, firstVerse: 1, lastVerse: 1 })).toBeNull();
		expect(passageFrom({ book: 42, chapter: 3, firstVerse: 0, lastVerse: 2 })).toBeNull();
	});

	it('links local text, language data, and attributed commentary to the selected passage', async () => {
		const evidence = await localEvidence({ book: 42, chapter: 3, firstVerse: 16, lastVerse: 16 });
		expect(evidence.passageText).toContain('16 ');
		expect(evidence.contextText).toContain(evidence.passageText);
		expect(evidence.sources.some((source) => source.kind === 'scripture' && source.scope === 'direct')).toBe(true);
		expect(evidence.sources.some((source) => source.author === 'Matthew Henry' && source.tradition === 'protestant')).toBe(true);
		expect(evidence.terms.length).toBeGreaterThan(0);
		expect(evidence.terms.every((term) => evidence.sources.some((source) => source.id === term.sourceId))).toBe(true);
	});

	it('shows only reviewed Shorts for the passage and labels them as link-only', () => {
		const found = passageVideos({ book: 0, chapter: 3, firstVerse: 7, lastVerse: 7 });
		expect(found.map((video) => [video.platform, video.url, video.durationSeconds])).toEqual([['youtube', 'https://www.youtube.com/shorts/jQm8ElP8Kj0', 165]]);
		expect(found.every((video) => video.scope === 'direct' && video.verification === 'video link only')).toBe(true);
		expect(found[0]).not.toHaveProperty('book');
		expect(passageVideos({ book: 42, chapter: 3, firstVerse: 16, lastVerse: 16 })).toEqual([]);
	});

	it('picks earlier-book notes that together cover the most history topics', () => {
		const note = (id: string, from: [number, number], to: [number, number], text: string) => ({ id, title: id, from, to, text });
		const book = {
			'1': { notes: [
				note('river', [1, 1], [1, 2], 'They camped by the river.'),
				note('tax', [1, 3], [1, 4], 'The king raised a tax on silver.'),
				note('plain', [1, 5], [1, 5], 'He spoke to them.'),
				note('span', [1, 6], [2, 4], 'The temple stood near the wall.')
			] },
			'2': { notes: [
				note('river-late', [2, 1], [2, 2], 'A second river crossing.'),
				note('span', [1, 6], [2, 4], 'The temple stood near the wall.'),
				note('after', [2, 9], [2, 9], 'The army marched by the sea.')
			] }
		};
		const start = 2 * 1000 + 8;
		const picked = bookContextNotes(book, start, 3).map((n) => n.id);
		// Ties go to the note nearest the passage; the cross-chapter note appears once.
		expect(picked).toEqual(['span', 'tax', 'river-late']);
		expect(bookContextNotes(book, start).map((n) => n.id)).not.toContain('after');
		expect(bookContextNotes(book, start).map((n) => n.id)).not.toContain('plain');
		expect(bookContextNotes(book, 1000 + 1)).toEqual([]);
	});

	it('adds earlier-book study notes as related background for later passages', async () => {
		const later = await localEvidence({ book: 40, chapter: 6, firstVerse: 14, lastVerse: 29 });
		const related = later.sources.filter((source) => source.kind === 'study_note' && source.scope === 'related');
		expect(related.length).toBeGreaterThan(0);
		expect(related.length).toBeLessThanOrEqual(6);
		expect(new Set(later.sources.map((source) => source.id)).size).toBe(later.sources.length);
		const first = await localEvidence({ book: 0, chapter: 1, firstVerse: 1, lastVerse: 1 });
		expect(first.sources.some((source) => source.scope === 'related' && source.kind === 'study_note')).toBe(false);
	});
	it('loads actual public-domain Scripture for references explicitly cited by the passage notes', async () => {
		const evidence = await localEvidence({ book:0, chapter:1, firstVerse:1, lastVerse:2 });
		const john = evidence.sources.find(source => source.id === 'bible:web:john:1:1-3');
		expect(john).toMatchObject({ kind:'scripture', scope:'related', location:'John 1:1–3', license:'Public domain' });
		expect(john?.excerpt).toContain('In the beginning was the Word');
		expect(john?.url).toBe('/read/web/john/1#v1');
	});
	it('bounds and deduplicates note cross-references without guessing invalid or cross-chapter ranges', async () => {
		await localEvidence({ book:0, chapter:1, firstVerse:1, lastVerse:1 });
		const refs = noteReferences([{ id:'refs', title:'References', from:[1,1], to:[1,1], text:'John 1:1–3; John 1:1–3; John 99:1; John 1:999; Genesis 1:2; John 1:1–2:3; Psalm 33:6; Isaiah 43:1; Isaiah 65:17.' }], { book:0, chapter:1, firstVerse:1, lastVerse:1 });
		expect(refs).toEqual([
			{book:42,chapter:1,firstVerse:1,lastVerse:3},
			{book:18,chapter:33,firstVerse:6,lastVerse:6},
			{book:22,chapter:43,firstVerse:1,lastVerse:1}
		]);
	});
});
