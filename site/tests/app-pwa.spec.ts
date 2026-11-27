import { test, expect, type Locator, type Page } from '@playwright/test';
import { chmodSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const authFile = resolve('playwright/.auth/qa-user.json');
const press = async (target: Locator) => {
	if (await target.page().evaluate(() => matchMedia('(pointer:coarse)').matches)) await target.tap();
	else await target.click();
};
const controlled = (page: Page) => page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
const cachePaths = (page: Page) => page.evaluate(async () => (await Promise.all((await caches.keys()).map(async key =>
	(await (await caches.open(key)).keys()).map(request => new URL(request.url).pathname)
))).flat());

test('installs a scoped app and serves only a public offline fallback', async ({ page, context, browserName }) => {
	await page.goto('/sign-in');
	await controlled(page);
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
	const manifest = await (await page.request.get('/manifest.webmanifest')).json();
	expect(manifest).toMatchObject({ id: '/', scope: '/', start_url: '/read', display: 'standalone' });
	for (const icon of manifest.icons) {
		const dimensions = await page.evaluate(async src => {
			const img = new Image(); img.src = src; await img.decode(); return `${img.naturalWidth}x${img.naturalHeight}`;
		}, icon.src);
		expect(dimensions).toBe(icon.sizes);
	}
	if (browserName === 'chromium') {
		const cdp = await context.newCDPSession(page);
		const result = await cdp.send('Page.getAppManifest');
		expect(result.errors).toEqual([]);
		const installability = await cdp.send('Page.getInstallabilityErrors');
		expect(installability.installabilityErrors).toEqual([]);
		await cdp.detach();
	}
	await press(page.getByText('Add Bible to your Home Screen', { exact: true }));
	await expect(page.getByText(/On iPhone, open this site in Safari/)).toBeVisible();
	// A replacement worker waits for an explicit reload, preserving the open page.
	await page.evaluate(async () => {
		await navigator.serviceWorker.register('/service-worker.js?update-test=1', { scope:'/', type:'module', updateViaCache:'none' });
	});
	await expect(page.getByRole('button', { name:'Reload to update' })).toBeVisible();
	await expect(page).toHaveURL(/\/sign-in$/);
	await press(page.getByRole('button', { name:'Later', exact:true }));
	await expect(page.getByRole('button', { name:'Reload to update' })).toHaveCount(0);
	// Deferring one release must not suppress the next worker in this open app.
	await page.evaluate(async () => {
		await navigator.serviceWorker.register('/service-worker.js?update-test=2', { scope:'/', type:'module', updateViaCache:'none' });
	});
	await expect(page.getByRole('button', { name:'Reload to update' })).toBeVisible();
	await Promise.all([page.waitForEvent('load'), press(page.getByRole('button', { name:'Reload to update' }))]);
	await controlled(page);
	await expect(page.getByRole('heading', { name:'Welcome back.' })).toBeVisible();
	await expect.poll(() => cachePaths(page)).toEqual(['/offline.html']);
	await context.setOffline(true);
	await page.goto('/read/kjv/john/3');
	await expect(page.getByRole('heading', { name: 'Connect to continue' })).toBeVisible();
	await expect(page.locator('[data-v]')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Try again' })).toBeVisible();
	await context.setOffline(false);
	await press(page.getByRole('link', { name: 'Try again' }));
	await expect(page).toHaveURL(/\/sign-in$/);
	// A lost/cleared cache still gets a useful response from the installed worker.
	await page.evaluate(async () => { for (const key of await caches.keys()) await caches.delete(key); });
	await context.setOffline(true);
	await page.goto('/read');
	await expect(page.getByRole('heading', { name: 'Connect to continue' })).toBeVisible();
	await context.setOffline(false);
});

test('owner can navigate, study and save notes on phone sizes; offline never replays private pages', async ({ page, context, isMobile }) => {
	test.setTimeout(90_000);
	const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
	if (existsSync(authFile)) {
		const state = JSON.parse(readFileSync(authFile, 'utf8'));
		await context.addCookies(state.cookies);
	}
	await page.goto('/read/kjv/john/3');
	if (new URL(page.url()).pathname === '/sign-in') {
		await page.getByLabel('Email', { exact:true }).fill('mark@dusseauand.com');
		await page.getByLabel('Password', { exact:true }).fill('local-test-password-only');
		await press(page.getByRole('button', { name:'Sign in', exact:true }));
		await expect(page).toHaveURL(/\/read$/);
		await expect(page.locator('.window')).toHaveAttribute('aria-busy', 'false');
		await page.goto('/read/kjv/john/3');
	}
	await controlled(page);
	execFileSync('git', ['check-ignore', '--quiet', authFile]);
	mkdirSync(resolve('playwright/.auth'), { recursive:true, mode:0o700 });
	await context.storageState({ path:authFile, indexedDB:true });
	chmodSync(authFile, 0o600);
	await expect(page.locator('.window')).toHaveAttribute('aria-busy', 'false');
	const sizes = isMobile ? [
		{ width:360, height:780 }, // iPhone 12/13 mini
		{ width:390, height:844 }, // iPhone 12–14
		{ width:430, height:932 }, // Plus / Pro Max
		{ width:844, height:390 } // landscape
	] : [{ width:1440, height:900 }];
	for (const size of sizes) {
		await page.setViewportSize(size);
		await expect(page.getByTitle(/Jump to a book or chapter/)).toBeVisible();
		await press(page.getByTitle(/Jump to a book or chapter/));
		const books = page.getByRole('menu', { name:'Books', exact:true });
		await press(books.getByRole('menuitem', { name:'John', exact:true }));
		await press(books.getByRole('menuitem', { name:'3', exact:true }));
		await expect(books).not.toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	}
	if (isMobile) await page.setViewportSize({ width:390, height:844 });
	// Resizing the continuous reader can move its current-chapter anchor; select
	// the intended chapter by its heading instead of whichever chapter owns #v16.
	const chapter = page.locator('.chapter').filter({ has: page.getByRole('heading', { name:'3', exact:true }) });
	const verse = chapter.locator('[data-v="16"] .v').first();
	await verse.scrollIntoViewIfNeeded();
	if (isMobile) await verse.tap(); else await verse.click({ button:'right' });
	await press(page.getByRole('button', { name:'Add or edit note' }));
	await expect(page.getByRole('dialog', { name:'Note on John 3:16' })).toBeVisible();
	const note = page.getByRole('textbox', { name:'Note', exact:true });
	await note.fill('Mobile PWA test note');
	if (isMobile) expect(await note.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
	await press(page.getByRole('button', { name:'Done', exact:true }));
	await page.reload();
	await controlled(page);
	await expect(page.locator('.window')).toHaveAttribute('aria-busy', 'false');
	const savedNote = chapter.locator('[data-v="16"]').getByRole('button', { name:'Note', exact:true });
	await savedNote.scrollIntoViewIfNeeded();
	if (isMobile) {
		const bounds = (await savedNote.boundingBox())!;
		expect(bounds.width).toBeGreaterThanOrEqual(44);
		expect(bounds.height).toBeGreaterThanOrEqual(44);
		expect(bounds.x).toBeGreaterThanOrEqual(0);
		expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
	}
	await press(savedNote);
	await expect(page.getByRole('textbox', { name:'Note', exact:true })).toHaveValue('Mobile PWA test note');
	await press(page.getByRole('button', { name:'Done', exact:true }));
	if (isMobile) {
		await press(page.getByRole('button', { name:'More', exact:true }));
		await press(page.getByRole('menuitem', { name:'Settings', exact:true }));
		const settings = page.getByRole('dialog', { name:'Settings', exact:true });
		await press(settings.getByRole('tab', { name:'Data', exact:true }));
		await expect(settings.getByRole('button', { name:'Sign out' })).toBeVisible();
		await expect(settings.getByText('Add Bible to your Home Screen', { exact:true })).toBeVisible();
		await press(settings.getByRole('button', { name:'Close Settings' }));
		await press(page.getByRole('button', { name:'More', exact:true }));
		await press(page.getByRole('menuitem', { name:/Focus Mode/ }));
		await press(page.getByRole('button', { name:/Exit Focus/ }));
	}
	await expect.poll(() => cachePaths(page)).toEqual(['/offline.html']);
	await context.setOffline(true);
	await expect(page.getByRole('heading', { name:'Connect to continue' })).toBeVisible();
	await expect(page.locator('[data-v="16"]').first()).not.toBeVisible();
	await context.setOffline(false);
	await expect(page.locator('[data-v="16"]').first()).toBeVisible();
	// Cold offline navigation never serves the authenticated page or its saved notes.
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { name:'Connect to continue' })).toBeVisible();
	await expect(page.locator('[data-v]')).toHaveCount(0);
	await expect(page.getByText('Mobile PWA test note')).toHaveCount(0);
	await context.setOffline(false);
	await press(page.getByRole('link', { name:'Try again' }));
	await expect(page).toHaveURL(/\/read$/);
	expect(errors).toEqual([]);
	execFileSync('git', ['check-ignore', '--quiet', authFile]);
	mkdirSync(resolve('playwright/.auth'), { recursive:true, mode:0o700 });
	await context.storageState({ path:authFile, indexedDB:true });
	chmodSync(authFile, 0o600);
});
