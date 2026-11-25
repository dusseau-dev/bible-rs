import { self } from '$app/service-worker';
import { version } from '$app/env';

const CACHE = `bible-public-${version}`;
const OFFLINE = '/offline.html';

// Cache exactly one public document. Never store private HTML, session responses,
// translations, SvelteKit data or study requests, even when the network succeeds.
self.addEventListener('install', event => event.waitUntil(
	caches.open(CACHE).then(cache => cache.add(new Request(OFFLINE, { cache: 'reload' })))
));

self.addEventListener('activate', event => event.waitUntil((async () => {
	for (const key of await caches.keys()) {
		if (key.startsWith('read-') || (key.startsWith('bible-public-') && key !== CACHE)) await caches.delete(key);
	}
	await self.clients.claim();
})()));

// An update waits until the owner explicitly chooses to reload.
self.addEventListener('message', event => {
	if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', event => {
	if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin) return;
	event.respondWith((async () => {
		try {
			// Preserve redirects and HTTP errors: an unavailable service is not an offline success.
			return await fetch(event.request);
		} catch {
			const cached = await (await caches.open(CACHE)).match(OFFLINE);
			// Cache Storage can be evicted (including on sign-out).
			return cached ?? new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect to continue · Bible</title><h1>Connect to continue</h1><p>Your private Bible needs an internet connection to verify your session.</p><a href="/read">Try again</a></html>', {
				status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
			});
		}
	})());
});
