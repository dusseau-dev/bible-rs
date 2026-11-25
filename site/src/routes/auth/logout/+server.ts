import type { RequestHandler } from './$types';
import { ownerAuth } from '#lib/server/owner-auth.js';
import { SESSION_COOKIE } from '#lib/server/auth.js';

export const POST: RequestHandler = async ({ request, url, cookies }) => {
	if (request.headers.get('origin') !== url.origin) return new Response('Invalid origin', { status: 403 });
	try { await ownerAuth.logout(cookies.get(SESSION_COOKIE)); }
	catch { return new Response('Could not end the session. Please try again.', { status: 503 }); }
	cookies.delete(SESSION_COOKIE, { path: '/' });
	return new Response(null, { status: 303, headers: { location: '/sign-in', 'clear-site-data': '"cache"' } });
};
