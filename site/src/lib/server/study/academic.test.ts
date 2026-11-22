import { describe, expect, it } from 'vitest';
import { mergePapers, papersFromWorks, reviewedPapers } from './academic.js';

const genesis = { book: 0, chapter: 3, firstVerse: 7, lastVerse: 7 };

describe('scholarly papers', () => {
	it('includes the reviewed Genesis paper', () => {
		expect(reviewedPapers(genesis)[0]?.url).toContain('digitalcommons.andrews.edu');
	});
	it('accepts matching open access publication metadata and rejects broad results', () => {
		const papers = papersFromWorks([
			{ id: 'https://openalex.org/W1', display_name: 'Genesis 3:7 and shame', type: 'article', doi: 'https://doi.org/10.1000/test', best_oa_location: { landing_page_url: 'https://example.edu/paper' } },
			{ id: 'https://openalex.org/W2', display_name: 'Shame in modern life', type: 'article', best_oa_location: { landing_page_url: 'https://example.edu/other' } },
			{ id: 'https://openalex.org/W4', display_name: 'Genesis 30 and shame', type: 'article', best_oa_location: { landing_page_url: 'https://example.edu/chapter-30' } },
			{ id: 'https://openalex.org/W3', display_name: 'Genesis 3 commentary', type: 'dataset', best_oa_location: { landing_page_url: 'https://example.edu/data' } }
		], genesis);
		expect(papers).toHaveLength(1);
		expect(papers[0]).toMatchObject({ id: 'doi:10.1000/test', scope: 'direct', type: 'Journal article' });
	});
	it('deduplicates reviewed and discovered DOI records', () => {
		const seed = reviewedPapers(genesis)[0];
		expect(mergePapers([seed], [{ ...seed, url: 'https://example.edu/copy' }])).toHaveLength(1);
	});
});
