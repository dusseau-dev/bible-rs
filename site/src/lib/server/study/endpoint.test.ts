import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const limits = vi.hoisted(() => ({ allowStudy: vi.fn(), allowDiscovery: vi.fn(), allowVideoRefresh: vi.fn(), allowAi: vi.fn() }));
vi.mock('./limits.js', () => limits);
vi.mock('#lib/redis.js', () => ({ redis: null }));
vi.mock('$app/env/private', () => ({ CHEAPERINFERENCE_API_KEY: '', OPENAI_API_KEY: '' }));
import { POST } from '../../../routes/api/study/+server';
const input = { passage: { book: 42, chapter: 3, firstVerse: 16, lastVerse: 16 }, mode: 'open', style: 'standard' };
const send = (body: unknown = input, headers: Record<string, string> = {}) => {
 const url = new URL('https://private.example/api/study');
 return POST({ url, request: new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }), getClientAddress: () => 'test' } as Parameters<typeof POST>[0]) as Promise<Response>;
};
beforeEach(() => {
 limits.allowStudy.mockResolvedValue('allowed'); limits.allowDiscovery.mockResolvedValue('disabled'); limits.allowAi.mockResolvedValue(false); limits.allowVideoRefresh.mockResolvedValue(false);
 for (const key of ['EXA_API_KEY', 'YOUTUBE_API_KEY', 'OPENALEX_API_KEY']) vi.stubEnv(key, '');
 vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('provider private details')));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('study endpoint failures', () => {
 it('returns local evidence and explicit disabled search states', async () => {
  const response = await send(); const body = await response.json();
  expect(response.status).toBe(200); expect(body.sources.length).toBeGreaterThan(0);
  expect(body.discovery).toEqual({ sources: 'disabled', testimonials: 'disabled', papers: 'disabled', videos: 'disabled' });
 });
 it('distinguishes upstream failures from zero results without exposing diagnostics', async () => {
  vi.stubEnv('EXA_API_KEY', 'test-key'); limits.allowDiscovery.mockResolvedValue('allowed');
  const response = await send(); const body = await response.json();
  expect(body.discovery.sources).toBe('failed'); expect(body.discovery.testimonials).toBe('failed');
  expect(JSON.stringify(body)).not.toContain('private details'); expect(body.sources.length).toBeGreaterThan(0);
 });
 it('distinguishes an unavailable limiter from a reader exceeding a limit', async () => {
  limits.allowStudy.mockResolvedValue('failed'); expect((await send()).status).toBe(503);
  limits.allowStudy.mockResolvedValue('rate_limited'); expect((await send()).status).toBe(429);
 });
 it('does not expose AI transport diagnostics or discard evidence on failure', async () => {
  limits.allowAi.mockResolvedValue(true);
  const response = await send({ ...input, aiKey: 'fixture-key' });
  const body = await response.json();
  expect(response.status).toBe(200); expect(body.sources.length).toBeGreaterThan(0);
  expect(JSON.stringify(body)).not.toContain('private details');
  expect(body.answer).toBeNull();
 });
 it('rejects malformed, oversized, invalid and cross-origin input', async () => {
  expect((await send('{')).status).toBe(400);
  expect((await send('x'.repeat(8001))).status).toBe(413);
  expect((await send({ ...input, passage: { ...input.passage, lastVerse: 999 } })).status).toBe(400);
  expect((await send(input, { origin: 'https://other.example' })).status).toBe(403);
 });
});

it('returns source-only results without contacting AI when the budget denies inference', async () => {
 limits.allowAi.mockResolvedValue(false);
 const response = await send({ ...input, aiKey: 'ci_live_fixture' });
 const body = await response.json();
 expect(response.status).toBe(200);
 expect(body.sources.length).toBeGreaterThan(0);
 expect(body.claims).toEqual([]);
 expect(body.answer).toBeNull();
 expect(fetch).not.toHaveBeenCalled();
});

it('passes a provider response through citation validation before returning it', async () => {
 limits.allowAi.mockResolvedValue(true);
 vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
  claims: [{ layer: 'history', text: 'An unsupported historical claim.', sourceIds: ['bible:web'], tradition: 'none' }],
  answer: { text: 'A cited answer.', sourceIds: ['bible:web'] }, guide: []
 }) } }] }), { status: 200 }));
 const response = await send({ ...input, mode: 'ask', question: 'What does this passage say?', aiKey: 'ci_live_fixture' });
 const body = await response.json();
 expect(response.status).toBe(200);
 expect(body.claims).toEqual([]);
 expect(body.answer).toEqual({ text: 'A cited answer.', sourceIds: ['bible:web'] });
});

it('tells the reader when history verification fails while retaining other study content', async () => {
 const local = await (await send()).json();
 const note = local.sources.find((source: { kind: string }) => source.kind === 'study_note');
 limits.allowAi.mockResolvedValue(true);
 vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
  claims: [{ layer: 'history', text: 'A proposed fact needing verification.', sourceIds: [note.id], tradition: 'none' }],
  answer: { text: 'A cited answer.', sourceIds: ['bible:web'] }, guide: []
 }) } }] }))).mockRejectedValueOnce(new Error('private verification diagnostics'));
 const body = await (await send({ ...input, aiKey: 'ci_live_fixture' })).json();
 expect(body.claims).toEqual([]);
 expect(body.answer?.text).toBe('A cited answer.');
 expect(body.message).toBe('The study notes could not be checked right now. Source excerpts are still available.');
 expect(JSON.stringify(body)).not.toContain('private verification diagnostics');
});
