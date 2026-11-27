import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	outputDir: '../.context/playwright-results',
	reporter: 'list',
	use: { baseURL: 'https://localhost:55141', ignoreHTTPSErrors: true, headless: true, screenshot: 'only-on-failure', video: 'retain-on-failure', trace: 'retain-on-failure' },
	webServer: { command: 'node scripts/test-server.mjs', url: 'https://localhost:55141/sign-in', ignoreHTTPSErrors: true, reuseExistingServer: false, timeout: 60_000 },
	projects: [
		// Chromium's service-worker process needs this too for the disposable localhost certificate.
		{ name: 'desktop', use: { launchOptions: { args: ['--ignore-certificate-errors'] }, viewport: { width: 1440, height: 900 } } },
		{ name: 'phone', use: { launchOptions: { args: ['--ignore-certificate-errors'] }, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
		{ name: 'iphone-webkit', testMatch: ['app-pwa.spec.ts', 'mobile-interactions.spec.ts', 'passage-discoveries.spec.ts'], use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } }
	]
});
