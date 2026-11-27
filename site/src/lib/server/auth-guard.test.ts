import { expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ ready: true, session: vi.fn(async () => null as string | null) }));
vi.mock('#lib/server/owner-auth.js', () => ({ ownerAuth: auth }));
import { handle } from '../../hooks.server';

it('does not serve the reader to an unauthenticated request', async () => {
 const url = new URL('https://private.example/read/kjv/john/3');
 const event = { url, request: new Request(url), cookies: { get: () => undefined }, locals: {} };
 const response = await handle({ event, resolve: async () => new Response('private reader') } as unknown as Parameters<typeof handle>[0]);
 expect(response.status).not.toBe(200);
 expect(await response.text()).not.toContain('private reader');
});

it('rejects API and data requests, and only resolves verified sessions with private caching', async () => {
	for (const path of ['/api/study', '/api/study/lesson', '/api/nlt', '/translations/web.bbl', '/read/kjv/john/3']) {
		const url = new URL(`https://private.example${path}`);
		const event = { url, request: new Request(url), cookies: { get: () => 'token' }, locals: {}, isDataRequest: true };
		auth.session.mockResolvedValue(null);
		const resolve = vi.fn(async () => new Response('private', { headers: { 'vercel-cdn-cache-control': 'max-age=86400' } }));
		let response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
		expect(response.status).toBe(401); expect(resolve).not.toHaveBeenCalled();
		auth.session.mockResolvedValue('mark@dusseauand.com');
		response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
		expect(response.status).toBe(200); expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
		expect(response.headers.get('cache-control')).toBe('private, no-store');
	}
	auth.session.mockResolvedValue(null);
});

it('fails closed on Redis outage and missing auth configuration', async () => {
	const url = new URL('https://private.example/api/study');
	const event = { url, request: new Request(url), cookies: { get: () => 'token' }, locals: {} };
	const resolve = vi.fn();
	auth.session.mockRejectedValueOnce(new Error('private Redis detail'));
	const result = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
	expect(result.status).toBe(503); expect(await result.json()).toEqual({ error: 'Authentication is temporarily unavailable.' });
	auth.ready = false;
	expect((await handle({ event, resolve } as unknown as Parameters<typeof handle>[0])).status).toBe(503);
	expect(resolve).not.toHaveBeenCalled(); auth.ready = true;
});
