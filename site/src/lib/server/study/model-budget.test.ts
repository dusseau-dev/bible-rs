import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./limits.js', () => ({ allowAi: vi.fn() }));
import { allowAi } from './limits.js';
import { requestJson } from './answer';
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('denies provider transport when the individual call has no budget grant', async () => {
 vi.mocked(allowAi).mockResolvedValue(false);
 const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
 await expect(requestJson('fixture', 'instruction', {}, { type: 'object' }, AbortSignal.timeout(1000))).rejects.toThrow('AI budget unavailable');
 expect(fetcher).not.toHaveBeenCalled();
});
it('charges composition and review separately and allows bounded lesson output', async () => {
 vi.mocked(allowAi).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
 const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: '{}' })));
 vi.stubGlobal('fetch', fetcher);
 await requestJson('fixture', 'instruction', {}, { type: 'object' }, AbortSignal.timeout(1000), { maxOutputTokens: 8000 });
 expect(JSON.parse(fetcher.mock.calls[0][1].body).max_output_tokens).toBe(8000);
 await expect(requestJson('fixture', 'review', {}, { type: 'object' }, AbortSignal.timeout(1000))).rejects.toThrow('AI budget unavailable');
 expect(fetcher).toHaveBeenCalledTimes(1);
});
