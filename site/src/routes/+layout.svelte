<script lang="ts">
	import { onMount } from 'svelte';
	import type { Root } from 'react-dom/client';
	import type { LayoutProps } from './$types';
	import { startPwa } from '../lib/pwa/pwa.svelte';
	import UpdateNotice from '#lib/pwa/UpdateNotice.svelte';

	let { children, data }: LayoutProps = $props();
	let checking = $state(false);
	let sessionError = $state('');
	let retry = $state(() => {});
	onMount(startPwa);
	onMount(() => {
		const viewport = window.visualViewport;
		if (!viewport) return;
		const resize = () => {
			// Preserve pinch zoom: only adapt to keyboard/browser-chrome resizing at normal scale.
			if (viewport.scale !== 1) return;
			const style = document.documentElement.style;
			style.setProperty('--visual-height', `${viewport.height}px`);
			style.setProperty('--visual-top', `${viewport.offsetTop}px`);
			style.setProperty('--keyboard-inset', `${Math.max(0, innerHeight - viewport.height - viewport.offsetTop)}px`);
		};
		resize();
		viewport.addEventListener('resize', resize);
		viewport.addEventListener('scroll', resize);
		return () => { viewport.removeEventListener('resize', resize); viewport.removeEventListener('scroll', resize); };
	});
	onMount(() => {
		// The old offline cache must not outlive the private-reader rollout.
		void (async () => {
			if ('serviceWorker' in navigator) for (const registration of await navigator.serviceWorker.getRegistrations()) {
				if (new URL(registration.scope).pathname.startsWith('/read')) await registration.unregister();
			}
			if ('caches' in window) for (const key of await caches.keys()) if (key.startsWith('read-')) await caches.delete(key);
		})().catch(() => {});
		let serial = 0;
		const verify = async () => {
			if (!data.ownerEmail) return;
			const request = ++serial;
			checking = true;
			sessionError = '';
			try {
				const response = await fetch('/auth/session', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
				if (request !== serial) return;
				if (response.status >= 500) throw new Error('Session verification is temporarily unavailable. Please try again.');
				if (response.status !== 204) { location.replace('/sign-in'); return; }
				if (!document.hidden) checking = false;
			} catch (cause) {
				if (request === serial) sessionError = navigator.onLine
					? (cause instanceof Error && cause.message.startsWith('Session verification') ? cause.message : 'Unable to connect. Check your connection and try again.')
					: 'Connect to the internet to continue reading. Your saved notes and highlights are still on this device.';
			}
		};
		retry = () => { void verify(); };
		const hide = () => { if (data.ownerEmail) { serial++; checking = true; } };
		const visible = () => { if (document.hidden) hide(); else void verify(); };
		const offline = () => { hide(); if (data.ownerEmail) sessionError = 'Connect to the internet to continue reading. Your saved notes and highlights are still on this device.'; };
		window.addEventListener('offline', offline);
		window.addEventListener('online', verify);
		window.addEventListener('pageshow', verify);
		window.addEventListener('pagehide', hide);
		document.addEventListener('visibilitychange', visible);
		const channel = new BroadcastChannel('bible-auth');
		if (!data.ownerEmail && location.pathname === '/sign-in') channel.postMessage('signed-out');
		channel.onmessage = () => { if (data.ownerEmail) { checking = true; location.replace('/sign-in'); } };
		return () => { serial++; window.removeEventListener('offline', offline); window.removeEventListener('online', verify); window.removeEventListener('pageshow', verify); window.removeEventListener('pagehide', hide); document.removeEventListener('visibilitychange', visible); channel.close(); };
	});
	$effect(() => { document.documentElement.toggleAttribute('data-session-locked', checking); });

	onMount(() => {
		if (!import.meta.env.DEV) return;

		// Agentation is a React component; mount it only in the development browser.
		const host = document.createElement('div');
		document.body.append(host);
		let active = true;
		let root: Root | undefined;

		void Promise.all([import('agentation'), import('react'), import('react-dom/client')]).then(
			([{ Agentation }, { createElement }, { createRoot }]) => {
				if (!active) return;
				root = createRoot(host);
				root.render(createElement(Agentation));
			}
		);

		return () => {
			active = false;
			root?.unmount();
			host.remove();
		};
	});
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/favicon.png" />
</svelte:head>

<div hidden={checking}>{@render children()}</div>
{#if checking}
	<div class="session-screen"><div>
		<h1>{sessionError ? 'Connect to continue' : 'Checking your session…'}</h1>
		{#if sessionError}<p role="status">{sessionError}</p><button type="button" onclick={retry}>Try again</button>{/if}
	</div></div>
{:else}<UpdateNotice />{/if}

<style>
	:global(body) { margin:0; }
	:global(button), :global(summary) { touch-action:manipulation; -webkit-user-select:none; user-select:none; }
	:global([hidden]) { display:none !important; }
	:global(html[data-session-locked] [data-reader-portal]) { display:none !important; }
	.session-screen { position:fixed; inset:0; z-index:10000; display:grid; place-items:center; padding:24px; background:#fffdf7; color:#263442; font:16px/1.6 system-ui,sans-serif; }
	.session-screen > div { max-width:360px; }
	h1 { font:32px/1.2 Georgia,serif; }
	.session-screen button { min-height:48px; padding:10px 24px; border:0; border-radius:8px; background:#264c46; color:white; font:inherit; }
</style>
