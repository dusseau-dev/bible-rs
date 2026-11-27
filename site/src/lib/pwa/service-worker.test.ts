import { afterEach, beforeEach, expect, it, vi } from 'vitest';

type NavigationEvent = {
	request: Pick<Request, 'method' | 'mode' | 'url'>;
	respondWith: (response: Promise<Response>) => void;
};
const worker = vi.hoisted(() => ({
	listeners: new Map<string, (event: NavigationEvent) => void>(),
	location: { origin: 'https://bible.test' }
}));
vi.mock('$app/service-worker', () => ({ self: {
	location: worker.location,
	addEventListener: (name: string, handler: (event: NavigationEvent) => void) => worker.listeners.set(name, handler)
} }));
vi.mock('$app/env', () => ({ version: 'test' }));
import '../../service-worker/index';

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline'))));
afterEach(() => vi.unstubAllGlobals());

function navigate() {
	let result: Promise<Response> | undefined;
	worker.listeners.get('fetch')!({
		request: { method: 'GET', mode: 'navigate', url: 'https://bible.test/read' },
		respondWith: response => { result = response; }
	});
	return result!;
}

it.each(['open', 'match'])('provides a public reconnect screen when Cache Storage %s fails', async failure => {
	vi.stubGlobal('caches', { open: async () => {
		if (failure === 'open') throw new Error('Cache Storage unavailable');
		return { match: async () => { throw new Error('Cache lookup unavailable'); } };
	} });
	const response = await navigate();
	expect(response.status).toBe(503);
	expect(response.headers.get('cache-control')).toBe('no-store');
	expect(await response.text()).toContain('Connect to continue');
});

it('preserves an HTTP denial even when the offline cache cannot be opened', async () => {
	vi.mocked(fetch).mockResolvedValue(new Response('Sign in to continue.', { status: 401 }));
	const open = vi.fn().mockRejectedValue(new Error('Cache Storage unavailable'));
	vi.stubGlobal('caches', { open });
	expect((await navigate()).status).toBe(401);
	expect(open).not.toHaveBeenCalled();
});
