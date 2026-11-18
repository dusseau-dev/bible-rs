import type { StudySource } from '#lib/read/study.js';
import { passageLabel, traditionForDomain } from './evidence.js';
import type { StudyPassage } from '#lib/read/study.js';

const DOMAINS = ['bibleodyssey.org', 'ccel.org', 'oyc.yale.edu', 'bible.usccb.org', 'oca.org', 'sefaria.org'];

const allowed = (url: string) => {
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'https:' && DOMAINS.some((domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
	} catch {
		return false;
	}
};

interface ExaResult {
	title?: string;
	url?: string;
	author?: string;
	highlights?: string[];
	text?: string;
}

export function sourcesFromExa(results: ExaResult[], p: StudyPassage): StudySource[] {
	const reference = passageLabel(p);
	const seen = new Set<string>();
	return results.flatMap((item, i) => {
		if (!item.url || !allowed(item.url) || seen.has(item.url)) return [];
		seen.add(item.url);
		const url = item.url;
		const host = new URL(url).hostname;
		const excerpt = (item.highlights?.join(' … ') || item.text || '').replace(/\s+/g, ' ').trim().slice(0, 500);
		const title = (item.title || host).trim().slice(0, 180);
		const direct = Boolean(excerpt) && `${title} ${excerpt}`.toLowerCase().includes(`${reference.split(':')[0]}:${p.firstVerse}`.toLowerCase());
		return [{
			id: `web:${i}:${url}`,
			title,
			author: (item.author || host).trim().slice(0, 120),
			kind: host.includes('bibleodyssey.org') || host.includes('yale.edu') ? 'academic' as const : 'commentary' as const,
			tradition: traditionForDomain(url),
			scope: direct ? 'direct' as const : 'related' as const,
			url,
			location: direct ? reference : 'Related reading',
			license: 'Link only',
			excerpt
		}];
	});
}

/** One domain-filtered search; it cannot fetch arbitrary user-provided URLs. */
export async function discover(p: StudyPassage, apiKey: string): Promise<StudySource[]> {
	const label = passageLabel(p);
	const query = `${label} historical context commentary Catholic Orthodox${p.book < 39 ? ' Jewish' : ''}`;
	const response = await fetch('https://api.exa.ai/search', {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
		body: JSON.stringify({ query, type: 'lite', numResults: 6, includeDomains: DOMAINS, contents: { highlights: true } }),
		signal: AbortSignal.timeout(8_000)
	});
	if (!response.ok) throw new Error(`Exa ${response.status}`);
	const data = (await response.json()) as { results?: ExaResult[] };
	return sourcesFromExa(data.results ?? [], p);
}
