import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('$app/env/private', () => ({ CHEAPERINFERENCE_API_KEY: 'fixture-server-key', OPENAI_API_KEY: '' }));
vi.mock('#lib/redis.js', () => ({ redis: null }));
vi.mock('./limits.js', () => ({ allowStudy: vi.fn(async () => 'allowed'), allowDiscovery: vi.fn(async () => 'disabled'), allowVideoRefresh: vi.fn(async () => false) }));
vi.mock('./research-packet.js', () => ({ collectResearch: vi.fn() }));
vi.mock('./discoveries.js', () => ({ selectDiscoveries: vi.fn() }));
vi.mock('./lesson-store.js', () => ({ savePacket: vi.fn() }));
vi.mock('./answer.js', () => ({ generateStudy: vi.fn() }));
import { collectResearch } from './research-packet.js';
import { selectDiscoveries } from './discoveries.js';
import { savePacket } from './lesson-store.js';
import { generateStudy } from './answer.js';
import { POST } from '../../../routes/api/study/+server';
import { fixturePacket, fixtureDiscovery } from './discovery-fixtures';
const send = (mode: string) => {
 const url = new URL('https://test.example/api/study');
 return POST({ url, locals: { ownerEmail: 'reader@example.test' }, getClientAddress: () => 'test', request: new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passage: fixturePacket().passage, mode, style: 'standard', ...(mode === 'ask' ? { question: 'What does this mean?' } : {}) }) }) } as Parameters<typeof POST>[0]) as Promise<Response>;
};
beforeEach(() => {
 vi.clearAllMocks(); for (const key of ['EXA_API_KEY', 'YOUTUBE_API_KEY', 'OPENALEX_API_KEY']) vi.stubEnv(key, '');
 vi.mocked(collectResearch).mockResolvedValue(fixturePacket()); vi.mocked(selectDiscoveries).mockResolvedValue([fixtureDiscovery()]);
 vi.mocked(savePacket).mockImplementation(async (owner, packet, items) => ({ packetId: owner ? 'packet' : null, evidenceVersion: packet.evidenceVersion, promptVersion: '1', research: packet.research, items }));
 vi.mocked(generateStudy).mockResolvedValue({ claims: [], guide: [], answer: { text: 'Answer', sourceIds: ['bible:web'] } });
});
afterEach(() => vi.unstubAllEnvs());
it('opens reviewed discoveries and owner-scoped expansion without duplicate legacy generation', async () => {
 const response = await send('open'), body = await response.json();
 expect(response.status).toBe(200); expect(body.discoveries.items).toHaveLength(1);
 expect(body.sources.some((s: { id: string }) => s.id === 's1')).toBe(true);
 expect(savePacket).toHaveBeenCalledWith('reader@example.test', expect.anything(), expect.anything());
 expect(generateStudy).not.toHaveBeenCalled();
});
it('preserves Ask and source-only fallback when discovery review fails', async () => {
 expect((await (await send('ask')).json()).answer.text).toBe('Answer'); expect(collectResearch).not.toHaveBeenCalled();
 vi.mocked(selectDiscoveries).mockRejectedValueOnce(new Error('provider private details'));
 const body = await (await send('open')).json(); expect(body.sources.length).toBeGreaterThan(0); expect(body.claims).toEqual([]);
 expect(body.message).toContain('Source excerpts'); expect(JSON.stringify(body)).not.toContain('private details');
 expect(generateStudy).toHaveBeenCalledOnce();
});
it('retains validated previews without expansion when storage is unavailable', async () => {
 vi.mocked(savePacket).mockRejectedValueOnce(new Error('storage unavailable'));
 const body = await (await send('open')).json(); expect(body.discoveries.packetId).toBeNull(); expect(body.discoveries.items).toHaveLength(1);
});
