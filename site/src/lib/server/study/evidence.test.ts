import { describe, expect, it } from 'vitest';
import { bookContextNotes, localEvidence, passageFrom, passageVideos } from './evidence';

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

	it('shows only reviewed video matches and labels them as link-only', () => {
		const found = passageVideos({ book: 44, chapter: 8, firstVerse: 1, lastVerse: 4 });
		expect(found).toHaveLength(2);
		expect(found.every((video) => video.scope === 'direct' && video.verification === 'video link only')).toBe(true);
		expect(passageVideos({ book: 42, chapter: 3, firstVerse: 16, lastVerse: 16 })).toEqual([]);
		expect(passageVideos({ book: 0, chapter: 3, firstVerse: 7, lastVerse: 7 }).map((video) => video.format)).toEqual(['short', 'full']);
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
});
