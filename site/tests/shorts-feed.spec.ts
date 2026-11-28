import { test as base, expect } from '@playwright/test';
import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { StudyResult, StudyVideo } from '../src/lib/read/study';

const authFile = resolve('playwright/.auth/qa-user.json');
const test = base.extend({ storageState: async ({}, use) => { await use(existsSync(authFile) ? authFile : undefined); } });
test.beforeEach(async ({ page }) => {
	await page.goto('/read/kjv/john/3');
	if (new URL(page.url()).pathname === '/sign-in') {
		await page.getByLabel('Email', { exact: true }).fill('mark@dusseauand.com');
		await page.getByLabel('Password', { exact: true }).fill('local-test-password-only');
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		await expect(page).toHaveURL(/\/read$/);
		await page.goto('/read/kjv/john/3');
	}
	await expect(page.locator('[data-v="16"]').first()).toBeVisible();
	await expect(page.locator('.window')).toHaveAttribute('aria-busy', 'false');
});
test.afterEach(async ({ context }) => {
	execFileSync('git', ['check-ignore', '--quiet', authFile]);
	mkdirSync(resolve('playwright/.auth'), { recursive: true, mode: 0o700 });
	await context.storageState({ path: authFile, indexedDB: true });
	chmodSync(authFile, 0o600);
});

const video = (platform: StudyVideo['platform'], id: string, title: string, channel: string): StudyVideo =>
	({ id, platform, title, channel, url: `https://example.com/${platform}/${id}`, scope: 'direct', verification: 'video link only', durationSeconds: 84 });
const videos = [
	video('youtube', 'abcdefghijk', 'John 3:16 in sixty seconds', 'Rives Church'),
	video('tiktok', '7312345678901234567', 'For God so loved the world: John 3:16 explained', '@bible.daily'),
	video('instagram', 'C1a2b3c4d5', 'John 3:16 reel', 'Instagram creator')
];
const result: StudyResult = {
	reference: 'John 3:16', passageText: 'For God so loved the world.', contextText: '', sources: [], terms: [], claims: [],
	guide: [{ id: 'respond', question: '', answer: 'Receive the gift.', sourceIds: [] }], videos, papers: [], testimonials: [], answer: null,
	discovery: { sources: 'complete', papers: 'complete', testimonials: 'complete', videos: 'complete' }
};

test('plays shorts in a vertical feed and opens it from the All shelf', async ({ page }) => {
	const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
	await page.route('**/api/study', route => route.fulfill({ json: result }));
	// Keep the run offline: platform posters and players are stubbed.
	await page.route(/i\.ytimg\.com|youtube-nocookie\.com|tiktok\.com|instagram\.com/, route => route.fulfill({ contentType: 'text/html', body: '<body style="background:#123"></body>' }));
	await page.locator('#v16 .v').first().click({ button: 'right' });
	await page.getByRole('button', { name: 'More passage actions' }).click();
	await page.getByRole('menuitem', { name: /Go deeper/i }).click();
	const folio = page.getByRole('dialog', { name: 'Go deeper passage study' });

	const shelf = folio.getByRole('region', { name: 'Shorts' });
	await expect(shelf.getByRole('listitem')).toHaveCount(3);
	await expect(folio.locator('ol.items')).not.toContainText('John 3:16 reel');

	await shelf.getByRole('button', { name: 'Watch For God so loved the world: John 3:16 explained' }).click();
	await expect(folio.getByRole('button', { name: /^Videos/ })).toHaveAttribute('aria-pressed', 'true');
	const feed = folio.getByRole('region', { name: /^Shorts, 3 videos/ });
	const slides = feed.getByRole('article');
	await expect(slides).toHaveCount(3);
	await expect(slides.nth(1)).toBeInViewport({ ratio: 0.9 });
	const box = await slides.nth(1).locator('.card').boundingBox();
	expect(box!.height / box!.width).toBeCloseTo(16 / 9, 1);
	await expect(slides.nth(1).getByRole('link', { name: 'Open on TikTok (opens in a new tab)' })).toHaveAttribute('href', videos[1].url);
	await expect(feed.locator('iframe')).toHaveCount(0);

	await slides.nth(1).getByRole('button', { name: /^Play / }).click();
	await expect(slides.nth(1).locator('iframe')).toHaveAttribute('src', 'https://www.tiktok.com/player/v1/7312345678901234567?autoplay=1&rel=0');
	await feed.focus();
	await page.keyboard.press('ArrowDown');
	await expect(slides.nth(2)).toBeInViewport({ ratio: 0.9 });
	await expect(feed.locator('iframe')).toHaveCount(0);
	expect(errors).toEqual([]);
});
