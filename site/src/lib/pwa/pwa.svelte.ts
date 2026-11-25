interface InstallPrompt extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const pwa = $state({
	installed: false,
	prompt: null as InstallPrompt | null,
	waiting: null as ServiceWorker | null,
	updating: false,
	error: ''
});

export function startPwa() {
	let active = true;
	let registration: ServiceWorkerRegistration | undefined;
	const standalone = matchMedia('(display-mode: standalone)');
	const installed = () => { pwa.installed = standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true; };
	const offered = (event: Event) => { event.preventDefault(); pwa.prompt = event as InstallPrompt; };
	const accepted = () => { pwa.installed = true; pwa.prompt = null; };
	const changed = () => { if (pwa.updating) location.reload(); };
	const check = () => { if (!document.hidden && navigator.onLine) void registration?.update().catch(() => {}); };
	installed();
	standalone.addEventListener('change', installed);
	window.addEventListener('beforeinstallprompt', offered);
	window.addEventListener('appinstalled', accepted);
	document.addEventListener('visibilitychange', check);
	if ('serviceWorker' in navigator && !import.meta.env.DEV) {
		navigator.serviceWorker.addEventListener('controllerchange', changed);
		void navigator.serviceWorker.register('/service-worker.js', { scope: '/', type: 'module', updateViaCache: 'none' }).then(reg => {
			if (!active) return;
			registration = reg;
			const ready = () => { if (active && reg.waiting && navigator.serviceWorker.controller) pwa.waiting = reg.waiting; };
			ready();
			reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', ready));
		}).catch(() => { if (active) pwa.error = 'App setup could not finish. Reconnect and reload to try again.'; });
	}
	return () => {
		active = false;
		standalone.removeEventListener('change', installed);
		window.removeEventListener('beforeinstallprompt', offered);
		window.removeEventListener('appinstalled', accepted);
		document.removeEventListener('visibilitychange', check);
		navigator.serviceWorker?.removeEventListener('controllerchange', changed);
	};
}

export async function installApp() {
	const prompt = pwa.prompt;
	if (!prompt) return;
	pwa.prompt = null;
	try { await prompt.prompt(); await prompt.userChoice; }
	catch { pwa.error = 'Use your browser menu to add Bible to your Home Screen.'; }
}

export function updateApp() {
	if (!pwa.waiting) return;
	pwa.updating = true;
	// Another open tab may have activated this update while the notice was visible.
	if (pwa.waiting.state !== 'installed') { location.reload(); return; }
	pwa.waiting.postMessage({ type: 'SKIP_WAITING' });
}
