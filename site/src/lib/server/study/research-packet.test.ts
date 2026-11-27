import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./limits.js', () => ({ allowDiscovery: vi.fn().mockResolvedValue('allowed') }));
import { allowDiscovery } from './limits.js';
import { collectResearch, researchHostAllowed } from './research-packet';
const passage = { book: 18, chapter: 82, firstVerse: 1, lastVerse: 8 };
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('rejects spoofed hosts, credentials and non-HTTPS evidence locations', () => {
 expect(researchHostAllowed('https://www.metmuseum.org/art/1')).toBe(true);
 for (const url of ['https://metmuseum.org.evil.test/item', 'http://127.0.0.1/', 'https://user:pass@metmuseum.org/']) expect(researchHostAllowed(url)).toBe(false);
});
it('keeps forum questions and news leads out of factual evidence and charges every search', async () => {
 const fetcher = vi.fn().mockImplementation(async (_url, options) => {
  const body = JSON.parse(options.body);
  const host = body.includeDomains.includes('reddit.com') ? 'reddit.com' : body.includeDomains.includes('sciencedaily.com') ? 'sciencedaily.com' : 'bibleodyssey.org';
  return new Response(JSON.stringify({ results: [{ title: 'A related question', url: `https://${host}/example`, text: 'Evidence concerning an ancient assembly and its literary setting.' }] }));
 });
 vi.stubGlobal('fetch', fetcher);
 const result = await collectResearch(passage, [], 'test', 'fixture', AbortSignal.timeout(1000));
 expect(result.documents).toHaveLength(1);
 expect(result.questions).toHaveLength(1);
 expect(result.news).toHaveLength(1);
 expect(result.research).toEqual({ scholarship: 'complete', questions: 'complete', news: 'complete' });
 expect(allowDiscovery).toHaveBeenCalledTimes(3);
});
it('reports disabled research without making external calls', async () => {
 const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
 const packet = await collectResearch(passage, [], 'test', undefined, AbortSignal.timeout(1000));
 expect(packet.research.scholarship).toBe('disabled');
 expect(fetcher).not.toHaveBeenCalled();
});
it('reserves room for external evidence even when many local notes exist', async () => {
 const source = { id: 'local', title: 'Local', author: 'Fixture', kind: 'study_note' as const, tradition: null, scope: 'related' as const, url: '/read', location: 'Fixture', license: 'Original', excerpt: 'local '.repeat(1000) };
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ url: 'https://bibleodyssey.org/new', title: 'New evidence', text: 'New evidence '.repeat(1000) }] }))));
 const packet = await collectResearch(passage, Array.from({ length: 30 }, (_, i) => ({ ...source, id: `local${i}` })), 'test', 'key', AbortSignal.timeout(1000));
 expect(packet.documents.some(d => d.source.url === 'https://bibleodyssey.org/new')).toBe(true);
 expect(packet.documents.length).toBeLessThanOrEqual(16);
 expect(packet.documents.reduce((n, d) => n + d.source.excerpt.length, 0)).toBeLessThanOrEqual(48000);
});
it('ignores malformed provider fields instead of losing the local evidence', async () => {
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ results: [null, { url: 'https://bibleodyssey.org/example', title: {}, author: [], text: 12, highlights: [null, 'A usable evidence excerpt.'] }] }))));
 const packet = await collectResearch(passage, [], 'reader', 'key', AbortSignal.timeout(1000));
 expect(packet.documents[0].source.excerpt).toBe('A usable evidence excerpt.');
 expect(packet.documents[0].source.title).toBe('bibleodyssey.org');
});
it('groups records that report the same DOI without inventing identifiers', async () => {
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ results: [
  { url: 'https://bibleodyssey.org/first', text: 'A scholarly source excerpt.', doi: '10.1234/Example' },
  { url: 'https://asor.org/second', text: 'Another copy of the same work.', doi: 'https://doi.org/10.1234/example' }
 ] }))));
 const packet = await collectResearch(passage, [], 'reader', 'key', AbortSignal.timeout(1000));
 expect(packet.documents).toHaveLength(1);
 expect(packet.documents[0].originalWork).toBe('doi:10.1234/example');
});
