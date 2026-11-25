import type { Handle } from '@sveltejs/kit/hooks';
import { ownerAuth } from '#lib/server/owner-auth.js';
import { SESSION_COOKIE } from '#lib/server/auth.js';

const publicPaths = new Set(['/sign-in', '/auth/login', '/privacy', '/support']);
const unavailable = (data: boolean) => {
	const error = 'Authentication is temporarily unavailable.';
	const options = { status: 503, headers: { 'cache-control': 'no-store' } };
	return data ? Response.json({ error }, options) : new Response(error, options);
};

const reader = (path: string) =>
	['/read', '/topics', '/ark-of-the-covenant'].some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Reader pages (and the topic and object pages, set like them) carry the reader's default
 * appearance in the HTML; app.html swaps in the saved one.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname.replace(/\/$/, '') || '/';
	const dataRequest = path.startsWith('/api/') || path.startsWith('/translations/') || event.isDataRequest;
	if (!publicPaths.has(path)) {
		if (!ownerAuth.ready) return unavailable(dataRequest);
		try {
			const email = await ownerAuth.session(event.cookies.get(SESSION_COOKIE));
			if (!email) {
				if (dataRequest) return Response.json({ error: 'Sign in to continue.' }, { status: 401, headers: { 'cache-control': 'no-store' } });
				return new Response(null, { status: 303, headers: { location: '/sign-in', 'cache-control': 'no-store' } });
			}
			event.locals.ownerEmail = email;
		} catch { return unavailable(dataRequest); }
	}
	const response = await resolve(event, {
		transformPageChunk: reader(event.url.pathname)
			? ({ html }) =>
					html
						.replace('<html lang="en">', '<html lang="en" data-read data-theme="light" data-accent="ink">')
						.replace('content="#0a0a0b"', 'content="#ffffff"')
			: undefined
	});
	// Override route-level CDN caching too: no authenticated response is public.
	response.headers.set('cache-control', 'private, no-store');
	response.headers.set('vercel-cdn-cache-control', 'no-store');
	response.headers.set('cdn-cache-control', 'no-store');
	response.headers.set('x-robots-tag', 'noindex, nofollow');
	return response;
};
