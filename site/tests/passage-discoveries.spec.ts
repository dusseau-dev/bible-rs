import { test, expect, type Locator } from '@playwright/test';
import { existsSync, readFileSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixtureDiscovery, fixtureLesson, fixturePacket } from '../src/lib/server/study/discovery-fixtures';
import type { StudyResult } from '../src/lib/read/study';
const authFile = resolve('playwright/.auth/qa-user.json');
test.use({ serviceWorkers: 'block', actionTimeout: 10_000 });
const press = async (target: Locator) => { if (await target.page().evaluate(() => matchMedia('(pointer:coarse)').matches)) await target.tap(); else await target.click(); };
const sources = fixturePacket().documents.map(d => d.source);
const discoveries = [1, 2, 3].map((i) => ({ ...fixtureDiscovery(), id: `${i}${i}${i}${i}${i}${i}${i}${i}-1111-4111-8111-111111111111`, title: { ...fixtureDiscovery().title, text: `Discovery ${i}: a textual contrast` } }));
const result: StudyResult = { reference: 'John 3:16', passageText: 'For God so loved the world.', contextText: '', sources, terms: [], claims: [], guide: [], videos: [], papers: [], testimonials: [], answer: null, discoveries: { packetId: '22222222-2222-4222-8222-222222222222', evidenceVersion: 'fixture', promptVersion: 'fixture', items: discoveries, research: { scholarship: 'complete', questions: 'disabled', news: 'failed' } } };
let errors: string[];
test.beforeEach(async ({ page, context }) => {
 errors = []; page.on('pageerror', e => errors.push(e.message));
 if (existsSync(authFile)) await context.addCookies(JSON.parse(readFileSync(authFile, 'utf8')).cookies);
 await page.goto('/read/kjv/john/3');
 if (new URL(page.url()).pathname === '/sign-in') {
  await page.getByLabel('Email', { exact: true }).fill('mark@dusseauand.com');
  await page.getByLabel('Password', { exact: true }).fill('local-test-password-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.window')).toHaveAttribute('aria-busy', 'false');
  mkdirSync(resolve('playwright/.auth'), { recursive: true, mode: 0o700 }); await context.storageState({ path: authFile }); chmodSync(authFile, 0o600);
  await page.goto('/read/kjv/john/3');
 }
 await expect(page.locator('.window')).toHaveAttribute('aria-busy', 'false');
 await page.route('**/api/study', route => route.fulfill({ json: result }));
 if (page.viewportSize()!.width <= 700 && await page.locator('aside.sidebar').evaluate(el => el.classList.contains('shown'))) await press(page.getByRole('main').getByRole('button', { name: /Hide sidebar/ }));
 const verse = page.locator('#v16 .v').first(); await verse.scrollIntoViewIfNeeded();
 if (await page.evaluate(() => matchMedia('(pointer:coarse)').matches)) await verse.tap(); else await verse.click({ button: 'right' });
 await press(page.getByRole('button', { name: 'More passage actions' }));
 await press(page.getByRole('menuitem', { name: /Go deeper/ }));
 await expect(page.getByRole('button', { name: 'Read the full lesson' })).toHaveCount(3);
});
test.afterEach(() => expect(errors).toEqual([]));
test('expands one lesson, preserves focus and reuses the result across filters', async ({ page }) => {
 let calls = 0;
 await page.route('**/api/study/lesson', route => { calls++; const body = route.request().postDataJSON(); return route.fulfill({ json: { status: 'complete', lesson: { ...fixtureLesson(), discoveryId: body.discoveryId }, sources } }); });
 const first = page.getByRole('button', { name: 'Read the full lesson' }).first(); await press(first);
 await expect(first).toHaveAttribute('aria-expanded', 'true');
 await expect(page.getByRole('heading', { name: 'The payoff', exact: true })).toBeAttached();
 await expect(page.getByRole('img', { name: 'Relationships in this passage', exact: true })).toBeAttached();
 await press(page.getByRole('button', { name: 'Collapse lesson', exact: true })); await expect(first).toBeFocused();
 await press(first); expect(calls).toBe(1);
 await press(page.getByRole('dialog', { name: 'Go deeper passage study' }).getByRole('button', { name: /^History/ }));
 await press(page.getByRole('button', { name: /^Academic/ }));
 await press(page.getByRole('button', { name: 'Read the full lesson' }).first()); expect(calls).toBe(1);
 await expect(page.getByRole('button', { name: /^All/ })).toContainText('3 discoveries');
});
test('keeps previews when research is insufficient or expires', async ({ page }) => {
 let calls = 0;
 await page.route('**/api/study/lesson', route => { calls++; return route.fulfill({ status: calls === 1 ? 200 : 410, json: calls === 1 ? { status: 'insufficient', message: 'There is not enough verified evidence for a full lesson.' } : { status: 'expired', message: 'Refresh this passage’s discoveries.' } }); });
 await press(page.getByRole('button', { name: 'Read the full lesson' }).first());
 await expect(page.getByRole('status').filter({ hasText: 'not enough verified evidence' })).toBeVisible();
 await press(page.getByRole('button', { name: 'Read the full lesson' }).nth(1));
 await expect(page.getByRole('button', { name: 'Refresh discoveries' })).toBeVisible();
 await expect(page.getByRole('heading', { name: /Discovery [123]:/ })).toHaveCount(3);
});
test('fits narrow and landscape viewports across reader themes', async ({ page }) => {
 await page.route('**/api/study/lesson', route => route.fulfill({ json: { status: 'complete', lesson: fixtureLesson(), sources } }));
 await press(page.getByRole('button', { name: 'Read the full lesson' }).first());
 for (const [width, height] of [[360, 740], [390, 844], [430, 932], [844, 390]]) {
  await page.setViewportSize({ width, height });
  for (const theme of ['light', 'sepia', 'dark']) {
   await page.locator('html').evaluate((el, value) => el.setAttribute('data-theme', value), theme);
   const panel = page.getByRole('dialog', { name: 'Go deeper passage study' });
   expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
   expect(await panel.locator('.content').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
 }
});
