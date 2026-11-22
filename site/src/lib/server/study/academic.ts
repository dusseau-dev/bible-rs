import { Redis } from '@upstash/redis';
import { BOOKS } from '#lib/read/books.js';
import type { StudyPaper, StudyPassage } from '#lib/read/study.js';
import { allowPaperSearch } from './limits.js';

const CACHE_SECONDS = 7 * 24 * 60 * 60;
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;

/** Reviewed open access paper for the passage used in the first study experience. */
const REVIEWED: Array<StudyPaper & { book: number; chapter: number; firstVerse: number; lastVerse: number }> = [
	{
		id: 'doi:10.32597/jams/vol9/iss1/3',
		title: 'Dynamics of Shame in Genesis 3 and 4: Missiological Implications for Today',
		authors: 'Andrew Tompkins', venue: 'Journal of Adventist Mission Studies', year: 2013,
		type: 'Journal article', doi: '10.32597/jams/vol9/iss1/3',
		url: 'https://digitalcommons.andrews.edu/jams/vol9/iss1/3/',
		scope: 'context', openAccess: true,
		book: 0, chapter: 3, firstVerse: 1, lastVerse: 24
	}
];

export function reviewedPapers(p: StudyPassage): StudyPaper[] {
	return REVIEWED.filter((paper) => paper.book === p.book && paper.chapter === p.chapter &&
		paper.firstVerse <= p.lastVerse && paper.lastVerse >= p.firstVerse)
		.map(({ book: _book, chapter: _chapter, firstVerse: _firstVerse, lastVerse: _lastVerse, ...paper }) => paper);
}

interface OpenAlexWork {
	id?: string;
	display_name?: string;
	doi?: string | null;
	publication_year?: number | null;
	type?: string;
	authorships?: Array<{ author?: { display_name?: string } }>;
	primary_location?: { source?: { display_name?: string } } | null;
	best_oa_location?: { landing_page_url?: string | null; pdf_url?: string | null } | null;
}

function secureUrl(value: string | null | undefined): string | null {
	if (!value) return null;
	try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : null; }
	catch { return null; }
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function papersFromWorks(works: OpenAlexWork[], p: StudyPassage): StudyPaper[] {
	const book = BOOKS[p.book].name === 'Psalms' ? 'Psalms?' : escape(BOOKS[p.book].name);
	const chapter = new RegExp(`\\b${book}\\s+${p.chapter}(?!\\d)`, 'i');
	const seen = new Set<string>();
	return works.flatMap((work) => {
		const title = work.display_name?.trim().slice(0, 220);
		if (!title || !chapter.test(title)) return [];
		if (!['article', 'preprint', 'dissertation', 'report', 'book-chapter'].includes(work.type ?? '')) return [];
		const doi = work.doi?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/\/$/, '') ?? null;
		const id = doi ? `doi:${doi.toLowerCase()}` : work.id || '';
		if (!id || seen.has(id)) return [];
		const url = secureUrl(work.best_oa_location?.landing_page_url) || secureUrl(work.best_oa_location?.pdf_url);
		if (!url) return [];
		seen.add(id);
		const direct = Array.from({ length: p.lastVerse - p.firstVerse + 1 }, (_, i) =>
			new RegExp(`\\b${book}\\s+${p.chapter}:${p.firstVerse + i}(?!\\d)`, 'i').test(title)).some(Boolean);
		return [{
			id, title, authors: work.authorships?.slice(0, 3).map((item) => item.author?.display_name).filter(Boolean).join(', ') || 'Author unavailable',
			venue: work.primary_location?.source?.display_name || 'OpenAlex record',
			year: Number.isInteger(work.publication_year) ? work.publication_year! : null,
			type: ({ article: 'Journal article', preprint: 'Preprint', dissertation: 'Dissertation', report: 'Research report', 'book-chapter': 'Book chapter' } as Record<string, string>)[work.type!],
			doi, url, scope: direct ? 'direct' as const : 'context' as const, openAccess: true
		}];
	}).slice(0, 6);
}

export function mergePapers(reviewed: StudyPaper[], discovered: StudyPaper[]): StudyPaper[] {
	const seen = new Set<string>();
	return [...reviewed, ...discovered].filter((paper) => {
		if (seen.has(paper.id)) return false;
		seen.add(paper.id);
		return true;
	}).sort((a, b) => Number(b.scope === 'direct') - Number(a.scope === 'direct')).slice(0, 6);
}

/** Search only title/abstract metadata; do not fetch or submit paper bodies to the model. */
export async function passagePapers(p: StudyPassage, key: string | undefined, client: string): Promise<StudyPaper[]> {
	const reviewed = reviewedPapers(p);
	if (!key || !redis) return reviewed;
	const cacheKey = `bible:study:papers:${p.book}:${p.chapter}:${p.firstVerse}:${p.lastVerse}`;
	try {
		const cached = await redis.get<StudyPaper[]>(cacheKey);
		if (cached) return mergePapers(reviewed, cached);
	} catch { /* Reviewed links remain available. */ }
	if (!await allowPaperSearch(client)) return reviewed;
	const url = new URL('https://api.openalex.org/works');
	url.searchParams.set('search.title_and_abstract', `${BOOKS[p.book].name} ${p.chapter}`);
	url.searchParams.set('filter', 'is_oa:true,is_retracted:false');
	url.searchParams.set('per-page', '12');
	url.searchParams.set('select', 'id,display_name,doi,publication_year,type,authorships,primary_location,best_oa_location');
	try {
		const response = await fetch(url, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(7_000) });
		if (!response.ok) return reviewed;
		const data = await response.json() as { results?: OpenAlexWork[] };
		const found = papersFromWorks(data.results ?? [], p);
		try { await redis.set(cacheKey, found, { ex: CACHE_SECONDS }); } catch { /* Cache outage does not discard results. */ }
		return mergePapers(reviewed, found);
	} catch { return reviewed; }
}
