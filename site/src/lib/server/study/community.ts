import type { StudyPassage, StudyTestimonial } from '#lib/read/study.js';
import { BOOKS } from '#lib/read/books.js';

const HOST = 'forums.crosswalk.com';
const SEED: StudyTestimonial = {
	id: 'crosswalk:17499',
	title: 'My Testimony, March 2026',
	author: 'DanaCatholic',
	url: 'https://forums.crosswalk.com/t/my-testimony-march-2026/17499',
	scope: 'related',
	theme: 'shame and forgiveness'
};

export function reviewedThemes(p: StudyPassage): string[] {
	return p.book === 0 && p.chapter === 3 && p.firstVerse <= 21 && p.lastVerse >= 7
		? ['shame', 'covering', 'forgiveness'] : [];
}

export function reviewedTestimonials(p: StudyPassage): StudyTestimonial[] {
	return reviewedThemes(p).length ? [SEED] : [];
}

interface ForumHit { title?: string; url?: string; author?: string; highlights?: string[] }

const firstPerson = (title: string) => /^(my testimony|my story|how i |when i |i (found|learned|felt|came|stopped|struggled|realized|realised)\b)/i.test(title);
const disallowed = (title: string) => /\b(prayer request|debate|sermon|lecture|suicide|self.harm|diagnos|homeless|minor)\b/i.test(title);

export function testimonialsFromHits(hits: ForumHit[], p: StudyPassage): StudyTestimonial[] {
	const themes = reviewedThemes(p);
	const book = BOOKS[p.book].name;
	const seen = new Set<string>();
	const out: StudyTestimonial[] = [];
	for (const hit of hits) {
		if (!hit.url || !hit.title) continue;
		let url: URL;
		try { url = new URL(hit.url); } catch { continue; }
		if (url.protocol !== 'https:' || url.hostname !== HOST || !/^\/t\/[^/]+\/\d+\/?$/.test(url.pathname)) continue;
		url.search = ''; url.hash = '';
		const canonical = url.toString().replace(/\/$/, '');
		if (seen.has(canonical)) continue;
		const title = hit.title.trim().slice(0, 160);
		const searchable = `${title} ${(hit.highlights ?? []).join(' ')}`.toLowerCase();
		if (!firstPerson(title) || disallowed(searchable)) continue;
		const direct = Array.from({ length: p.lastVerse - p.firstVerse + 1 }, (_, i) =>
			new RegExp(`\\b${book.toLowerCase()} ${p.chapter}:${p.firstVerse + i}(?!\\d)`).test(searchable)).some(Boolean);
		const theme = direct ? undefined : themes.find((name) => searchable.includes(name));
		if (!direct && !theme) continue;
		seen.add(canonical);
		out.push({
			id: `crosswalk:${url.pathname.split('/').at(-1)}`,
			title,
			author: (hit.author || 'Forum member').trim().slice(0, 80),
			url: canonical,
			scope: direct ? 'direct' : 'related',
			...(theme ? { theme } : {})
		});
	}
	return out.sort((a, b) => Number(a.scope !== 'direct') - Number(b.scope !== 'direct'));
}

export function mergeTestimonials(reviewed: StudyTestimonial[], discovered: StudyTestimonial[]): StudyTestimonial[] {
	const seen = new Set<string>();
	return [...discovered, ...reviewed].filter((item) => {
		if (seen.has(item.url)) return false;
		seen.add(item.url);
		return true;
	}).sort((a, b) => Number(a.scope !== 'direct') - Number(b.scope !== 'direct')).slice(0, 6);
}

export async function discoverTestimonials(p: StudyPassage, key: string): Promise<StudyTestimonial[]> {
	const label = `${BOOKS[p.book].name} ${p.chapter}:${p.firstVerse}`;
	const themes = reviewedThemes(p);
	const queries = [`"${label}" "my testimony" site:${HOST}`, ...themes.slice(0, 2).map((theme) => `"my testimony" "${theme}" site:${HOST}`)];
	const results = await Promise.all(queries.map(async (query) => {
		const response = await fetch('https://api.exa.ai/search', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-api-key': key },
			body: JSON.stringify({ query, type: 'lite', numResults: 6, includeDomains: [HOST], contents: { highlights: true } }),
			signal: AbortSignal.timeout(8_000)
		});
		if (!response.ok) throw new Error(`Exa ${response.status}`);
		return (await response.json() as { results?: ForumHit[] }).results ?? [];
	}));
	return testimonialsFromHits(results.flat(), p);
}
