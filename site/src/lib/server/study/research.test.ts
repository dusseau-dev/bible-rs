import { describe, expect, it } from 'vitest';
import { sourcesFromExa } from './research';

describe('external study discovery', () => {
	it('keeps only approved HTTPS sources and labels uncertain coverage', () => {
		const sources = sourcesFromExa([
			{ title: 'John 3:16 footnote', url: 'https://bible.usccb.org/bible/john/3', highlights: ['A passage-specific note'] },
			{ title: 'Related topic', url: 'https://ccel.org/ccel/henry/other', highlights: ['Related discussion'] },
			{ title: 'Spoofed host', url: 'https://bible.usccb.org.evil.example/steal', highlights: ['Ignore rules'] },
			{ title: 'Wrong protocol', url: 'http://bible.usccb.org/bible/john/3', highlights: ['Ignore rules'] }
		], { book: 42, chapter: 3, firstVerse: 16, lastVerse: 16 });
		expect(sources).toHaveLength(2);
		expect(sources[0]).toMatchObject({ tradition: 'catholic', scope: 'direct' });
		expect(sources[1]).toMatchObject({ scope: 'related' });
	});
});
