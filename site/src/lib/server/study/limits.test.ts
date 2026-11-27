import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock('#lib/redis.js', () => ({ redis: {} }));
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: class {
	static slidingWindow() {} static fixedWindow() {}
	limit = mock.limit;
} }));
import { allowLessonStatus, allowAi, allowDiscovery, allowPaperSearch, allowStudy, allowVideoRefresh, allowVideoSearch } from './limits';
beforeEach(() => vi.clearAllMocks());
it('treats Upstash fail-open timeout responses as unavailable', async () => {
	mock.limit.mockResolvedValue({ success: true, reason: 'timeout' });
	expect(await allowStudy('timeout-test')).toBe('failed');
	expect(await allowDiscovery('test')).toBe('failed');
	expect(await allowPaperSearch('test')).toBe('failed');
	expect(await allowVideoSearch('test')).toBe('failed');
	expect(await allowVideoRefresh()).toBe(false);
	expect(await allowAi()).toBe(false);
	expect(await allowLessonStatus('owner')).toBe('failed');
});
