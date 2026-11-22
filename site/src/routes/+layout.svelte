<script lang="ts">
	import { onMount } from 'svelte';
	import type { Root } from 'react-dom/client';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

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
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
</svelte:head>

{@render children()}
