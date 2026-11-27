import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('#lib/redis.js', () => ({ redis: null }));
vi.mock('$app/env/private', () => ({ CHEAPERINFERENCE_API_KEY: 'fixture-key', OPENAI_API_KEY: '' }));
vi.mock('./lesson-store.js', () => ({ loadPacket: vi.fn(), getLesson: vi.fn(), claimLesson: vi.fn(), publishLesson: vi.fn(), releaseLesson: vi.fn() }));
vi.mock('./limits.js', () => ({ allowStudy: vi.fn(), allowLessonStatus: vi.fn() }));
vi.mock('./lesson.js', () => ({ composeLesson: vi.fn() }));
import * as store from './lesson-store.js';
import { allowStudy, allowLessonStatus } from './limits.js';
import { composeLesson } from './lesson.js';
import { POST } from '../../../routes/api/study/lesson/+server';
import { fixturePacket, fixtureDiscovery, fixtureLesson } from './discovery-fixtures';
const input = { packetId: '22222222-2222-4222-8222-222222222222', discoveryId: fixtureDiscovery().id, passage: fixturePacket().passage };
function send(body: unknown = input, owner = 'reader@example.test', headers: Record<string, string> = {}) {
 const url = new URL('https://test.example/api/study/lesson');
 return POST({ url, request: new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }), locals: { ownerEmail: owner }, getClientAddress: () => 'reader' } as Parameters<typeof POST>[0]) as Promise<Response>;
}
beforeEach(() => {
 vi.clearAllMocks();
 vi.mocked(store.loadPacket).mockResolvedValue({ packet: fixturePacket(), discoveries: [fixtureDiscovery()] } as Awaited<ReturnType<typeof store.loadPacket>>);
 vi.mocked(store.getLesson).mockResolvedValue(null); vi.mocked(store.claimLesson).mockResolvedValue('token'); vi.mocked(store.publishLesson).mockResolvedValue(true);
 vi.mocked(allowStudy).mockResolvedValue('allowed'); vi.mocked(allowLessonStatus).mockResolvedValue('allowed');
 vi.mocked(composeLesson).mockResolvedValue({ status: 'complete', lesson: fixtureLesson(), sources: fixturePacket().documents.map(d => d.source) });
});
it('validates authentication, origin, shape, size and passage before storage', async () => {
 expect((await send(input, '')).status).toBe(401);
 expect((await send(input, 'reader', { origin: 'https://elsewhere.test' })).status).toBe(403);
 expect((await send('x'.repeat(2001))).status).toBe(413);
 expect((await send('{')).status).toBe(400);
 expect((await send({ ...input, evidence: 'invented' })).status).toBe(400);
 expect((await send(input, 'reader', { 'content-type': 'text/plain' })).status).toBe(415);
 expect(store.loadPacket).not.toHaveBeenCalled();
});
it('rejects wrong owner, forged discovery, mismatch and expired packets', async () => {
 vi.mocked(store.loadPacket).mockResolvedValueOnce(null); expect((await send()).status).toBe(404);
 expect((await send({ ...input, discoveryId: input.packetId })).status).toBe(404);
 expect((await send({ ...input, passage: { ...input.passage, chapter: 83 } })).status).toBe(400);
 vi.mocked(store.loadPacket).mockRejectedValueOnce(new Error('Packet expired')); expect((await send()).status).toBe(410);
 expect(composeLesson).not.toHaveBeenCalled();
});
it('serves ten pending reads and a cache hit without consuming generation grants', async () => {
 vi.mocked(store.claimLesson).mockResolvedValue(null);
 for (let i = 0; i < 10; i++) { const response = await send(); expect(response.status).toBe(202); expect(response.headers.get('retry-after')).toBe('2'); }
 vi.mocked(store.getLesson).mockResolvedValue({ status: 'complete', lesson: fixtureLesson(), sources: [] });
 expect((await send()).status).toBe(200);
 expect(allowStudy).not.toHaveBeenCalled(); expect(composeLesson).not.toHaveBeenCalled();
});
it('enforces status and generation limits, releases on denial and never returns a lost publication', async () => {
 vi.mocked(allowLessonStatus).mockResolvedValueOnce('rate_limited'); expect((await send()).status).toBe(429);
 vi.mocked(allowStudy).mockResolvedValueOnce('failed'); expect((await send()).status).toBe(503); expect(store.releaseLesson).toHaveBeenCalled();
 vi.mocked(store.publishLesson).mockResolvedValueOnce(false); expect((await send()).status).toBe(503);
 const response = await send(); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
});
