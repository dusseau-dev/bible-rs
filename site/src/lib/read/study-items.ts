import { historyTopicLabel } from './history-topics';
import type { EvidenceScope, StudyResult } from './study';

export const categories = [
	{ id: 'history', label: 'History' },
	{ id: 'related', label: 'Related' },
	{ id: 'academic', label: 'Academic' },
	{ id: 'reflection', label: 'Reflection' },
	{ id: 'testimonials', label: 'Testimonials' },
	{ id: 'videos', label: 'Videos' }
] as const;
export type Category = (typeof categories)[number]['id'];
type Link = { title: string; url: string };
/** One thing worth noting, filed under one category with a more specific kind. */
type Item = { category: Category; kind: string; text: string; meta?: string; links: Link[]; scope: EvidenceScope };

const videoTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const clip = (text: string) => (text.length > 260 ? `${text.slice(0, 257).trimEnd()}…` : text);
const scopeNote: Record<EvidenceScope, string | undefined> = { direct: undefined, context: 'Chapter context', related: 'Related background' };
const scopeRank: Record<EvidenceScope, number> = { direct: 0, context: 1, related: 2 };
/** History notes name the history lens they touch, e.g. "Economy". */
const historyKind = (text: string) => historyTopicLabel(text) ?? 'Background';
const capitalized = (word: string) => word[0].toUpperCase() + word.slice(1);

export function itemsFrom(r: StudyResult): Item[] {
	const evidence = (ids: string[]) => {
		const scopes = ids.map(id => r.sources.find(s => s.id === id)?.scope ?? 'related');
		const scope = scopes.length ? scopes.reduce((a, b) => scopeRank[a] >= scopeRank[b] ? a : b) : 'related';
		return { scope, meta: scopeNote[scope] };
	};
	const cited = (ids: string[]) => {
		const links = new Map<string, Link>();
		for (const id of ids) {
			const source = r.sources.find((s) => s.id === id);
			if (source && !links.has(source.url)) links.set(source.url, { title: source.title, url: source.url });
		}
		return [...links.values()];
	};
	const items: Item[] = [];
	const add = (item: Omit<Item, 'scope'> & { scope?: EvidenceScope }) => items.push({ scope: 'direct', ...item });
	for (const step of r.guide) {
		if (!step.answer || step.id === 'observe') continue; // observe restates the verse shown above
		const links = cited(step.sourceIds);
		if (step.id === 'contextualize') add({ category: 'academic', kind: 'Context', text: step.answer, links, ...evidence(step.sourceIds) });
		else if (step.id === 'trace') add({ category: 'related', kind: 'Echoes in Scripture', text: step.answer, links, ...evidence(step.sourceIds) });
		else add({ category: 'reflection', kind: step.id === 'christ' ? 'Christ connection' : 'Response', text: step.answer, links, ...evidence(step.sourceIds) });
	}
	for (const claim of r.claims) {
		const base = { text: claim.text, links: cited(claim.sourceIds), ...evidence(claim.sourceIds) };
		if (claim.layer === 'history') add({ category: 'history', kind: historyKind(claim.text), ...base });
		else if (claim.layer === 'language') add({ category: 'academic', kind: 'Language', ...base });
		else if (claim.layer === 'uncertainty') add({ category: 'academic', kind: 'Debated', ...base });
		else if (claim.layer === 'interpretation') add({ category: 'academic', kind: claim.tradition ? `${capitalized(claim.tradition)} reading` : 'Interpretation', ...base });
	}
	for (const source of r.sources) {
		const link = [{ title: source.title, url: source.url }];
		const meta = [source.author, source.license, scopeNote[source.scope]].filter(Boolean).join(' · ');
		if (source.kind === 'scripture' && source.scope === 'related') add({ category: 'related', kind: 'Related passage', text: clip(source.excerpt), meta, links: link, scope: source.scope });
		if (source.kind === 'historical_record') add({ category: 'history', kind: historyKind(`${source.title} ${source.excerpt}`), text: clip(source.excerpt), meta, links: link, scope: source.scope });
		else if (source.kind === 'study_note' || source.kind === 'commentary' || source.kind === 'academic')
			add({ category: 'academic', kind: source.kind === 'study_note' ? 'Study note' : source.kind === 'commentary' ? 'Commentary' : 'Scholarship', text: clip(source.excerpt), meta, links: link, scope: source.scope });
	}
	for (const paper of r.papers ?? [])
		add({ category: 'academic', kind: 'Paper', text: paper.title, meta: [paper.authors, paper.year, scopeNote[paper.scope]].filter(Boolean).join(' · '), links: [{ title: paper.doi ? `DOI ${paper.doi}` : 'Open publication', url: paper.url }], scope: paper.scope });
	for (const story of r.testimonials)
		add({ category: 'testimonials', kind: story.theme ? capitalized(story.theme) : 'Story', text: story.title, meta: [story.author, scopeNote[story.scope]].filter(Boolean).join(' · '), links: [{ title: 'Read on the forum', url: story.url }], scope: story.scope });
	for (const video of r.videos)
		add({ category: 'videos', kind: video.reviewed ? 'Curated' : 'YouTube search', text: video.title, meta: [video.channel, video.durationSeconds ? videoTime(video.durationSeconds) : '', scopeNote[video.scope]].filter(Boolean).join(' · '), links: [{ title: 'Watch on YouTube', url: video.url }], scope: video.scope });
	const seen = new Set<string>();
	const order = (c: Category) => categories.findIndex((x) => x.id === c);
	return items
		.filter((item) => item.text && !seen.has(item.text) && seen.add(item.text))
		.sort((a, b) => order(a.category) - order(b.category) || scopeRank[a.scope] - scopeRank[b.scope]);
}
