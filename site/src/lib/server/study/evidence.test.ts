import { describe, expect, it } from 'vitest';
import { localEvidence, passageFrom, passageVideos } from './evidence';

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
});
