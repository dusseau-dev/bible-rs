import { beforeEach, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
const auth = vi.hoisted(() => ({ login: vi.fn(), logout: vi.fn() }));
vi.mock('#lib/server/owner-auth.js', () => ({ ownerAuth: auth }));
vi.mock('$app/env', () => ({ dev: false }));
import { POST as login } from '../../routes/auth/login/+server';
import { POST as logout } from '../../routes/auth/logout/+server';
import { readBody } from './body';
const cookies = { get: vi.fn(() => 'old-session'), set: vi.fn(), delete: vi.fn() };
function event<Path extends '/auth/login' | '/auth/logout'>(path: Path, body = 'email=mark%40dusseauand.com&password=example', origin = 'https://private.example') {
	const url = new URL(path, 'https://private.example');
	return { url, cookies, getClientAddress: () => 'test', request: new Request(url, { method: 'POST', body, headers: { origin, 'content-type': 'application/x-www-form-urlencoded' } }) } as unknown as RequestEvent<Record<string, never>, Path>;
}
beforeEach(() => { vi.clearAllMocks(); auth.login.mockResolvedValue({ status: 'ok', token: 'new-session' }); auth.logout.mockResolvedValue(undefined); });
it('rotates the previous session and sets an expiring secure HttpOnly cookie', async () => {
	const response = await login(event('/auth/login'));
	expect(response.status).toBe(303); expect(response.headers.get('location')).toBe('/read');
	expect(auth.logout).toHaveBeenCalledWith('old-session');
	expect(cookies.set).toHaveBeenCalledWith('bible_session', 'new-session', { path: '/', httpOnly: true, secure: true, sameSite: 'strict', maxAge: 43200 });
});
it('rejects cross-site and oversized login requests before checking credentials', async () => {
	expect((await login(event('/auth/login', '', 'https://other.example'))).status).toBe(403);
	expect((await login(event('/auth/login', 'a'.repeat(4097)))).status).toBe(413);
	expect(auth.login).not.toHaveBeenCalled();
});
it('does not set a cookie on an invalid login or failed session rotation', async () => {
	auth.login.mockResolvedValueOnce({ status: 'invalid' });
	expect((await login(event('/auth/login'))).headers.get('location')).toBe('/sign-in?error=invalid');
	auth.logout.mockRejectedValue(new Error('private detail'));
	expect((await login(event('/auth/login'))).status).toBe(503);
	expect(cookies.set).not.toHaveBeenCalled();
});
it('only clears the cookie after confirmed server-side logout', async () => {
	expect((await logout(event('/auth/logout', '', 'https://other.example'))).status).toBe(403);
	expect(auth.logout).not.toHaveBeenCalled();
	auth.logout.mockRejectedValueOnce(new Error('offline'));
	expect((await logout(event('/auth/logout'))).status).toBe(503);
	expect(cookies.delete).not.toHaveBeenCalled();
	const response = await logout(event('/auth/logout'));
	expect(response.status).toBe(303); expect(cookies.delete).toHaveBeenCalledWith('bible_session', { path: '/' });
});
it('bounds chunked bodies even without a Content-Length header', async () => {
	let cancelled = false;
	const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(32)); }, cancel() { cancelled = true; } });
	const request = new Request('https://private.example', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
	expect(await readBody(request, 64)).toBeNull(); expect(cancelled).toBe(true);
});
