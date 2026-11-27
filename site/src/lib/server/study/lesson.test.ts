import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('./answer.js', () => ({ requestJson: vi.fn() }));
vi.mock('./evidence-review.js', () => ({ reviewUnits: vi.fn() }));
vi.mock('./research-packet.js', async original => ({ ...await original<typeof import('./research-packet.js')>(), extendResearch: vi.fn(async p => p) }));
import { requestJson } from './answer.js';
import { reviewUnits } from './evidence-review.js';
import { composeLesson } from './lesson';
import { lessonUnits } from './discovery-schema';
import { fixturePacket, fixtureDiscovery, fixtureLesson } from './discovery-fixtures';
beforeEach(() => { vi.clearAllMocks(); const { images: _images, ...lesson } = fixtureLesson(); vi.mocked(requestJson).mockResolvedValue({ status: 'complete', lesson: { ...lesson, imageIds: [] } }); vi.mocked(reviewUnits).mockResolvedValue(new Set(lessonUnits(fixtureLesson()).map(u => u.id))); });
const run = () => composeLesson(fixturePacket(), fixtureDiscovery(), 'reader', 'key', undefined, AbortSignal.timeout(5000));
it('composes one complete reviewed lesson and loads real exercise passages', async () => {
 const result = await run(); expect(result.status).toBe('complete');
 expect(reviewUnits).toHaveBeenCalledOnce();
 const context = vi.mocked(reviewUnits).mock.calls[0][4] as { exercises: unknown[] };
 expect(context.exercises).toHaveLength(2);
 expect(requestJson).toHaveBeenCalledWith('key', expect.any(String), expect.anything(), expect.anything(), expect.anything(), { maxOutputTokens: 8000 });
});
it('keeps insufficient evidence distinct from transport failure and never returns unreviewed prose', async () => {
 vi.mocked(requestJson).mockResolvedValue({ status: 'insufficient', lesson: null }); expect((await run()).status).toBe('insufficient');
 vi.mocked(requestJson).mockRejectedValue(new Error('private provider details')); expect(await run()).toEqual({ status: 'unavailable', message: 'This lesson is unavailable right now. Try again later.' });
});
it('rejects invented images, a failed essential edge, and short prose', async () => {
 const { images: _images, ...lesson } = fixtureLesson();
 vi.mocked(requestJson).mockResolvedValue({ status: 'complete', lesson: { ...lesson, imageIds: ['https://invented.test/image.jpg'] } }); expect((await run()).status).toBe('insufficient');
 vi.mocked(requestJson).mockResolvedValue({ status: 'complete', lesson: { ...lesson, imageIds: [] } });
 vi.mocked(reviewUnits).mockResolvedValue(new Set(lessonUnits(fixtureLesson()).filter(u => u.id !== 'edge').map(u => u.id))); expect((await run()).status).toBe('insufficient');
 lesson.sections = []; vi.mocked(requestJson).mockResolvedValue({ status: 'complete', lesson: { ...lesson, imageIds: [] } }); expect((await run()).status).toBe('insufficient');
});
