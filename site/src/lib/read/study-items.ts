import { historyTopicLabel } from './history-topics';
import { TESTIMONIAL_PLATFORMS, VIDEO_PLATFORMS, type EvidenceScope, type StudyResult, type StudyVideo } from './study';

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
type Item = { category: Category; kind: string; title?: string; text: string; meta?: string; attribution?: string; links: Link[]; scope: EvidenceScope; video?: StudyVideo };

export const videoTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
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
	const represented = new Set<string>();
	const add = (item: Omit<Item, 'scope'> & { scope?: EvidenceScope }) => items.push({ scope: 'direct', ...item });
	const note = (title: string | undefined, text: string, ids: string[]) => {
		ids.forEach(id => represented.add(id));
		const attribution = [...new Set(r.sources.filter(s => ids.includes(s.id) && s.license.startsWith('CC BY'))
			.map(s => `${s.author} · ${s.license}`))].join('; ');
		return { title, text, links: cited(ids), ...evidence(ids), ...(attribution ? { attribution } : {}) };
	};
	for (const step of r.discoveries ? [] : r.guide) {
		if (!step.answer || step.id === 'observe') continue; // observe restates the verse shown above
		if (step.id === 'contextualize' && r.claims.some(claim => claim.layer === 'text' || claim.layer === 'interpretation')) continue;
		if (step.id === 'trace' && !r.sources.some(s => step.sourceIds.includes(s.id) && s.kind === 'scripture' && s.scope === 'related')) continue;
		const base = note(step.title, step.answer, step.sourceIds);
		if (step.id === 'contextualize') add({ category: 'academic', kind: 'Context', ...base });
		else if (step.id === 'trace') add({ category: 'related', kind: 'Echoes in Scripture', ...base });
		else add({ category: 'reflection', kind: step.id === 'christ' ? 'Christ connection' : 'Response', ...base });
	}
	for (const claim of r.discoveries ? [] : r.claims) {
		const base = note(claim.title, claim.text, claim.sourceIds);
		if (claim.layer === 'text') add({ category: 'academic', kind: 'Text & structure', ...base });
		else if (claim.layer === 'history') add({ category: 'history', kind: historyKind(claim.text), ...base });
		else if (claim.layer === 'language') add({ category: 'academic', kind: 'Language', ...base });
		else if (claim.layer === 'uncertainty') add({ category: 'academic', kind: 'Debated', ...base });
		else if (claim.layer === 'interpretation') add({ category: 'academic', kind: claim.tradition ? `${capitalized(claim.tradition)} reading` : 'Interpretation', ...base });
	}
	const hasInsights = items.length > 0;
	for (const source of r.sources) {
		if (represented.has(source.id)) continue;
		// Unselected source summaries are not extra insights in an edited study.
		if (hasInsights && ['study_note', 'commentary', 'academic', 'scripture'].includes(source.kind)) continue;
		const link = [{ title: source.title, url: source.url }];
		const meta = [source.author, source.license, scopeNote[source.scope]].filter(Boolean).join(' · ');
		if (source.kind === 'scripture' && source.scope === 'related') add({ category: 'related', kind: 'Related passage', text: clip(source.excerpt), meta, links: link, scope: source.scope });
		if (source.kind === 'historical_record') add({ category: 'history', kind: historyKind(`${source.title} ${source.excerpt}`), title: source.title, text: clip(source.excerpt), meta, links: link, scope: source.scope });
		else if (source.kind === 'study_note' || source.kind === 'commentary' || source.kind === 'academic')
			add({ category: 'academic', kind: source.kind === 'study_note' ? 'Study note' : source.kind === 'commentary' ? 'Commentary' : 'Scholarship', title: source.title, text: clip(source.excerpt), meta, links: link, scope: source.scope });
	}
	for (const paper of r.papers ?? [])
		add({ category: 'academic', kind: 'Paper', text: paper.title, meta: [paper.authors, paper.year, scopeNote[paper.scope]].filter(Boolean).join(' · '), links: [{ title: paper.doi ? `DOI ${paper.doi}` : 'Open publication', url: paper.url }], scope: paper.scope });
	for (const story of r.testimonials) {
		const platform = TESTIMONIAL_PLATFORMS[story.platform ?? 'crosswalk'];
		add({ category: 'testimonials', kind: platform, text: story.excerpt || story.title, meta: [story.author, story.theme ? capitalized(story.theme) : scopeNote[story.scope]].filter(Boolean).join(' · '), links: [{ title: `Read on ${platform}`, url: story.url }], scope: story.scope });
	}
	for (const video of r.videos)
		add({ category: 'videos', kind: VIDEO_PLATFORMS[video.platform].label, text: video.title, meta: [video.channel, video.durationSeconds ? videoTime(video.durationSeconds) : '', scopeNote[video.scope]].filter(Boolean).join(' · '), links: [{ title: `Open on ${VIDEO_PLATFORMS[video.platform].name}`, url: video.url }], scope: video.scope, video });
	const unique = new Map<string, Item>();
	for (const item of items) {
		const key = item.text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
		if (!key) continue;
		const existing = unique.get(key);
		if (!existing) unique.set(key, item);
		else {
			existing.links = [...new Map([...existing.links, ...item.links].map(link => [link.url, link])).values()];
			existing.attribution = [...new Set([existing.attribution, item.attribution].filter(Boolean))].join('; ') || undefined;
		}
	}
	const order = (c: Category) => categories.findIndex((x) => x.id === c);
	return [...unique.values()]
		.sort((a, b) => order(a.category) - order(b.category) || scopeRank[a.scope] - scopeRank[b.scope]);
}

/** Interpretive categories count discoveries; media categories count resources. */
export function studyCounts(result: StudyResult) {
 const resources = itemsFrom(result);
 const discoveries = result.discoveries?.items ?? [];
 const counts = Object.fromEntries(categories.map(({ id }) => [id,
  result.discoveries && !['videos', 'testimonials'].includes(id)
   ? discoveries.filter(d => d.category === id).length : resources.filter(r => r.category === id).length
 ])) as Record<Category, number>;
 return { discoveries: discoveries.length, resources: resources.length, categories: counts };
}
