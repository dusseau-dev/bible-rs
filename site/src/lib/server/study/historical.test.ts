import { describe, expect, it } from 'vitest';
import { historicalRecordSources } from './historical.js';

describe('curated historical records', () => {
	it('links the Assyrian campaign to the relevant passage', () => {
		const sources = historicalRecordSources({ book: 11, chapter: 18, firstVerse: 13, lastVerse: 16 });
		expect(sources.map((source) => source.id)).toEqual(['imj:sennacherib:prism', 'met:sennacherib:701']);
		expect(sources.every((source) => source.scope === 'context')).toBe(true);
	});
	it('labels the Isaiah scroll as manuscript context for the whole book', () => {
		expect(historicalRecordSources({ book: 22, chapter: 6, firstVerse: 1, lastVerse: 1 }).map((source) => source.id)).toEqual(['imj:isaiah:scroll']);
	});
	it('does not claim the Cyrus Cylinder reproduces the Ezra decree', () => {
		const [source] = historicalRecordSources({ book: 14, chapter: 1, firstVerse: 1, lastVerse: 4 });
		expect(source.id).toBe('met:cyrus:cylinder');
		expect(source.excerpt).toContain('does not name Judah');
		expect(historicalRecordSources({ book: 13, chapter: 36, firstVerse: 22, lastVerse: 23 }).some((item) => item.id === source.id)).toBe(true);
	});
	it('does not imply an artifact documents the Genesis 3 narrative', () => {
		expect(historicalRecordSources({ book: 0, chapter: 3, firstVerse: 7, lastVerse: 7 })).toEqual([]);
	});
});
