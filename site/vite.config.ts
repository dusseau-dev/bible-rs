/// <reference types="vitest/config" />
import vercel from '@sveltejs/adapter-vercel';
import type { Adapter } from '@sveltejs/kit';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite';
import { addHeaders, compactRoutes } from './scripts/vercel-routes.js';

const base = vercel();
const adapter: Adapter = {
	...base,
	async adapt(builder) {
		await base.adapt(builder);
		compactRoutes('.vercel/output/config.json');
		// An NLT chapter's address shows the KJV's page (src/hooks.ts): kept out of search results.
		addHeaders('.vercel/output/config.json', '^/read/nlt(?:/.*)?$', { 'X-Robots-Tag': 'noindex' });
		addHeaders('.vercel/output/config.json', '^/.*$', { 'X-Robots-Tag': 'noindex, nofollow' });
	}
};

export default defineConfig(({ mode }) => {
	// Some server code reads its keys from process.env (Upstash, YouTube, Exa, OpenAlex). Vercel sets
	// them there; locally they live in .env files, which Vite doesn't copy to process.env on its own.
	for (const [name, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) process.env[name] ??= value;
	return {
		plugins: [
			sveltekit({
				compilerOptions: {
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				adapter,
				// The root layout registers the public-fallback worker and handles update prompts.
				serviceWorker: { register: false }
			})
		],
		test: { include: ['src/**/*.test.ts'] },
		// Tests mount components in Node (in a happy-dom document), so they take Svelte's browser build.
		resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
		// The object pages import their specs from ../objects (objects/README.md).
		server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), '../objects'] } }
	};
});
