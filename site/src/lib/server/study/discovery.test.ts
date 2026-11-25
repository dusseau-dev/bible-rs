import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), limit: vi.fn() }));
vi.mock('#lib/redis.js', () => ({ redis: { get: mocks.get, set: mocks.set } }));
vi.mock('./limits.js', () => ({ allowVideoSearch: mocks.limit, allowPaperSearch: mocks.limit }));
import { passagePapers } from './academic';
import { discoverPassageVideos } from './youtube';
const passage = { book: 0, chapter: 3, firstVerse: 7, lastVerse: 7 };
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue(null); mocks.set.mockResolvedValue('OK'); mocks.limit.mockResolvedValue('allowed'); });
afterEach(() => vi.unstubAllGlobals());
describe('discovery outcomes', () => {
 it('reports disabled discovery while preserving reviewed papers', async () => {
  const papers = await passagePapers(passage, undefined, 'reader');
  expect(papers.status).toBe('disabled'); expect(papers.items).toHaveLength(1);
  expect(await discoverPassageVideos(passage, undefined, 'reader')).toEqual({ items: [], status: 'disabled' });
 });
 it('distinguishes a completed empty search from a failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }))));
  expect((await passagePapers(passage, 'test', 'reader')).status).toBe('complete');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private detail')));
  const result = await passagePapers(passage, 'test', 'reader');
  expect(result.status).toBe('failed'); expect(result.items).toHaveLength(1);
 });
 it('retains the reason discovery was limited or unavailable', async () => {
  for (const status of ['rate_limited', 'failed'] as const) {
   mocks.limit.mockResolvedValue(status);
   expect((await passagePapers(passage, 'test', 'reader')).status).toBe(status);
   expect((await discoverPassageVideos(passage, 'test', 'reader')).status).toBe(status);
  }
 });
 it('does not cache partial video searches as complete', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}', { status: 503 })).mockResolvedValueOnce(new Response('{"items":[]}')));
  expect(await discoverPassageVideos(passage, 'test', 'reader')).toEqual({ items: [], status: 'partial' });
  expect(mocks.set).not.toHaveBeenCalled();
 });
 it('uses a completed cached empty search without consuming budget', async () => {
  mocks.get.mockResolvedValue([]);
  expect(await discoverPassageVideos(passage, 'test', 'reader')).toEqual({ items: [], status: 'complete' });
  expect(mocks.limit).not.toHaveBeenCalled();
 });
});
