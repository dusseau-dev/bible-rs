import { createHash } from 'node:crypto';
import type { Discovery, DiscoveryBundle, ResearchImage } from '#lib/read/discoveries.js';
import type { StudyPassage, StudySource } from '#lib/read/study.js';
import { passageLabel, traditionForDomain } from './evidence.js';
import { allowDiscovery } from './limits.js';
import { approvedImages } from './research-images.js';

const FOUNDATION = ['bibleodyssey.org', 'ccel.org', 'oyc.yale.edu', 'bible.usccb.org', 'oca.org', 'sefaria.org', 'metmuseum.org', 'britishmuseum.org', 'imj.org.il', 'asor.org', 'thetorah.com', 'biblicalarchaeology.org', 'penelope.uchicago.edu'];
const QUESTIONS = ['reddit.com', 'forums.crosswalk.com'];
const NEWS = ['archaeology.org', 'sciencedaily.com'];
export interface ResearchDocument {
 source: StudySource; role: 'foundation' | 'lead'; contentLevel: 'excerpt' | 'abstract' | 'full';
 publishedAt: string | null; retrievedAt: string; originalWork: string;
 reuse: { license: string; licenseUrl: string | null };
}
export interface ResearchLead { title: string; url: string; publishedAt: string | null }
export interface SupportRecord { unitId: string; supports: Array<{ sourceId: string; quote: string }> }
export interface ResearchPacket {
 reviews?: SupportRecord[];
 passage: StudyPassage; documents: ResearchDocument[]; questions: ResearchLead[]; news: ResearchLead[];
 images: ResearchImage[]; research: DiscoveryBundle['research']; retrievedAt: string; evidenceVersion: string;
}
interface Hit { doi?: string; url?: string; title?: string; author?: string; text?: string; highlights?: string[]; publishedDate?: string; }
function normalizeHit(value: unknown): Hit | null {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
 const raw = value as Record<string, unknown>;
 if (typeof raw.url !== 'string') return null;
 const field = (name: string) => typeof raw[name] === 'string' ? raw[name] as string : undefined;
 return { doi: field('doi'), url: raw.url, title: field('title'), author: field('author'), text: field('text'), publishedDate: field('publishedDate'), highlights: Array.isArray(raw.highlights) ? raw.highlights.filter((v): v is string => typeof v === 'string') : [] };
}
function allowed(url: string, domains: string[]): boolean {
 try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && !u.port && domains.some(d => u.hostname === d || u.hostname.endsWith(`.${d}`)); } catch { return false; }
}
export const researchHostAllowed = (url: string) => allowed(url, FOUNDATION);
function canonical(url: string): string { const u = new URL(url); u.hash = ''; for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_')) u.searchParams.delete(k); return u.href; }
export function boundPacket(packet: ResearchPacket): ResearchPacket {
 let remaining = 48_000;
 const seen = new Set<string>();
 const documents = packet.documents.flatMap(d => {
  const identity = d.originalWork;
  if (!remaining || seen.has(identity) || seen.size >= 16 || !d.source.excerpt.trim()) return [];
  seen.add(identity);
  const excerpt = d.source.excerpt.slice(0, Math.min(6000, remaining)); remaining -= excerpt.length;
  return [{ ...d, source: { ...d.source, excerpt } }];
 });
 const images = packet.images.filter(i => documents.some(d => d.source.id === i.sourceId));
 const evidenceVersion = createHash('sha256').update(JSON.stringify({ documents: documents.map(({ retrievedAt: _time, ...d }) => d), images })).digest('hex');
 return { ...packet, documents, images, evidenceVersion };
}
function documents(hits: Hit[], at: string): ResearchDocument[] {
 return hits.filter(h => typeof h.url === 'string' && researchHostAllowed(h.url)).flatMap(h => {
  const doi = h.doi?.replace(/^https:\/\/doi\.org\//i, '').trim().toLowerCase();
  const url = canonical(h.url!), excerpt = (h.text || h.highlights?.join(' … ') || '').trim().slice(0, 6000);
  if (!excerpt) return [];
  return [{ source: { id: `research:${createHash('sha256').update(url).digest('hex').slice(0, 20)}`, title: (h.title || new URL(url).hostname).slice(0, 200), author: (h.author || new URL(url).hostname).slice(0, 150), kind: 'academic' as const, tradition: traditionForDomain(url), scope: 'related' as const, url, location: 'Retrieved excerpt; passage relevance requires review', license: 'Link and limited excerpt', excerpt }, role: 'foundation' as const, contentLevel: 'excerpt' as const, publishedAt: h.publishedDate || null, retrievedAt: at, originalWork: doi && /^10\.\d{4,9}\/\S+$/.test(doi) ? `doi:${doi}` : url, reuse: { license: 'Link and limited excerpt', licenseUrl: null } }];
 });
}
async function search(query: string, domains: string[], address: string, key: string | undefined, signal: AbortSignal, leads = false): Promise<{ hits: Hit[]; status: DiscoveryBundle['research']['scholarship'] }> {
 if (!key) return { hits: [], status: 'disabled' };
 const grant = await allowDiscovery(address);
 if (grant !== 'allowed') return { hits: [], status: grant };
 try {
  const response = await fetch('https://api.exa.ai/search', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key }, signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), body: JSON.stringify({ query, type: 'lite', numResults: 6, includeDomains: domains, ...(leads ? {} : { contents: { text: { maxCharacters: 6000, includeHtmlTags: false }, highlights: true } }) }) });
  if (!response.ok) throw new Error('Search unavailable');
  const data = await response.json();
  return { hits: Array.isArray(data.results) ? data.results.slice(0, 6).map(normalizeHit).filter((h: Hit | null): h is Hit => !!h && allowed(h.url!, domains)) : [], status: 'complete' };
 } catch { return { hits: [], status: 'failed' }; }
}
export async function collectResearch(passage: StudyPassage, localSources: StudySource[], address: string, key: string | undefined, signal: AbortSignal): Promise<ResearchPacket> {
 const label = passageLabel(passage), at = new Date().toISOString(), media = approvedImages(passage);
 const [scholarship, questions, news] = await Promise.all([
  search(`${label} historical context literary structure manuscript original language scholarly evidence`, FOUNDATION, address, key, signal),
  search(`${label} questions misunderstanding interpretation`, QUESTIONS, address, key, signal, true),
  search(`${label} archaeological research manuscript discovery`, NEWS, address, key, signal, true)
 ]);
 const lead = (hits: Hit[]): ResearchLead[] => hits.map(h => ({ title: (h.title || '').slice(0, 200), url: h.url!, publishedAt: h.publishedDate || null }));
 const local = (source: StudySource): ResearchDocument => ({ source, role: 'foundation', contentLevel: 'excerpt', publishedAt: null, retrievedAt: at, originalWork: source.id, reuse: { license: source.license, licenseUrl: null } });
 const selected = localSources.filter(s => s.kind === 'scripture').slice(0, 3);
 const retained = [...selected.map(local), ...media.sources.map(local), ...documents(scholarship.hits, at), ...localSources.filter(s => !selected.includes(s)).map(local)];
 return boundPacket({ passage, documents: retained, questions: lead(questions.hits), news: lead(news.hits), images: media.images, retrievedAt: at, evidenceVersion: '', research: { scholarship: scholarship.status, questions: questions.status, news: news.status } });
}
export async function extendResearch(packet: ResearchPacket, discovery: Discovery, address: string, key: string | undefined, signal: AbortSignal): Promise<ResearchPacket> {
 const found = await search(`${passageLabel(packet.passage)} ${discovery.title.text} evidence alternative interpretation`, FOUNDATION, address, key, signal);
 // Excerpts are sufficient when supplied; contents is reserved for server-discovered records without text.
 const urls = found.hits.filter(h => !h.text && !h.highlights?.length).map(h => h.url!).slice(0, 4);
 let extra: Hit[] = [];
 if (key && urls.length && await allowDiscovery(address) === 'allowed') {
  try {
   const response = await fetch('https://api.exa.ai/contents', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key }, signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), body: JSON.stringify({ urls, text: { maxCharacters: 6000, includeHtmlTags: false } }) });
   if (response.ok) { const data = await response.json(); extra = Array.isArray(data.results) ? data.results.slice(0, 4).map(normalizeHit).filter((h: Hit | null): h is Hit => !!h && urls.includes(h.url!)) : []; }
  } catch { /* Retain previously reviewed evidence. */ }
 }
 const cited = new Set([discovery.title, ...discovery.explanation, discovery.payoff].flatMap(u => u.sourceIds));
 return boundPacket({ ...packet, documents: [...packet.documents.filter(d => cited.has(d.source.id)), ...documents([...found.hits, ...extra], new Date().toISOString()), ...packet.documents.filter(d => !cited.has(d.source.id))] });
}
