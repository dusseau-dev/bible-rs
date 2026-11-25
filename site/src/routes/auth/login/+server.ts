import type { RequestHandler } from './$types';
import { dev } from '$app/env';
import { ownerAuth } from '#lib/server/owner-auth.js';
import { SESSION_COOKIE, SESSION_SECONDS } from '#lib/server/auth.js';
import { readBody } from '#lib/server/body.js';

export const POST: RequestHandler = async ({ request, url, cookies, getClientAddress }) => {
	if (request.headers.get('origin') !== url.origin) return new Response('Invalid origin', { status: 403 });
	if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return new Response('Expected a sign-in form', { status: 415 });
	const body = await readBody(request, 4096);
	if (body === null) return new Response('Form is too large', { status: 413 });
	const form = new URLSearchParams(body);
	const result = await ownerAuth.login(form.get('email') ?? '', form.get('password') ?? '', getClientAddress());
	if (result.status !== 'ok') return new Response(null, { status: 303, headers: { location: `/sign-in?error=${result.status}` } });
	const previous = cookies.get(SESSION_COOKIE);
	try { await ownerAuth.logout(previous); } catch { return new Response('Sign-in temporarily unavailable', { status: 503 }); }
	cookies.set(SESSION_COOKIE, result.token, { path: '/', httpOnly: true, secure: !dev || url.protocol === 'https:', sameSite: 'strict', maxAge: SESSION_SECONDS });
	return new Response(null, { status: 303, headers: { location: '/read' } });
};
