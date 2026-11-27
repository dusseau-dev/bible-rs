import { test as base, expect } from '@playwright/test';
import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { StudyResult } from '../src/lib/read/study';

const authFile = resolve('playwright/.auth/qa-user.json');
const test = base.extend({ storageState: async ({}, use) => { await use(existsSync(authFile) ? authFile : undefined); } });
test.beforeEach(async ({ page }) => {
	await page.goto('/read/kjv/john/3');
	if (new URL(page.url()).pathname === '/sign-in') {
		await page.getByLabel('Email', { exact: true }).fill('mark@dusseauand.com');
		await page.getByLabel('Password', { exact: true }).fill('local-test-password-only');
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		await expect(page).toHaveURL(/\/read$/);
		await expect(page.locator('.window')).toHaveAttribute('aria-busy', 'false');
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

test('protects direct URLs and APIs; authenticated local evidence works', async ({ browser, page }) => {
	const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
	try {
		const other = await anonymous.newPage();
		await other.goto('https://localhost:55141/read/kjv/john/3');
		await expect(other).toHaveURL(/\/sign-in$/);
		for (const path of ['/api/study', '/api/nlt?ref=John+3', '/translations/web.bbl']) {
			const response = await anonymous.request.get(`https://localhost:55141${path}`, { maxRedirects: 0 });
			expect(response.status()).toBe(401);
		}
	} finally { await anonymous.close(); }
	const response = await page.request.post('/api/study', { data: { passage: { book: 42, chapter: 3, firstVerse: 16, lastVerse: 16 }, mode: 'open', style: 'standard' } });
	expect(response.status()).toBe(200);
	const result: StudyResult = await response.json();
	expect(result.sources.length).toBeGreaterThan(0);
	expect(result.discovery?.videos).toBe('disabled');
});

test('shows accurate categories, related citations and discovery states', async ({ page }) => {
	test.setTimeout(60_000);
	const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
	let complete = false;
	const result: StudyResult = {
		reference: 'John 3:16', passageText: 'For God so loved the world.', contextText: '',
		sources: [{ id: 'language', title: 'John 3:8', author: 'Aquifer', kind: 'study_note', scope: 'related', tradition: null, url: 'https://example.org/note', location: 'John 3:8', license: 'CC BY-SA 4.0', excerpt: 'In Greek, the word for wind is the same as for spirit.' }, { id: 'history', title: 'Historical record', author: 'Museum', kind: 'historical_record', scope: 'context', tradition: null, url: 'https://example.org/record', location: '', license: 'Link only', excerpt: 'A record of ancient village life.' }],
		claims: [{ layer: 'history', text: 'A contextual historical claim.', sourceIds: ['history'], tradition: null }],
		terms: [], guide: [{ id: 'contextualize', question: '', answer: 'A literary interpretation, not a historical fact.', sourceIds: ['language'] }], videos: [], papers: [], testimonials: [], answer: null,
		discovery: { sources: 'complete', papers: 'disabled', testimonials: 'failed', videos: 'partial' }
	};
	await page.route('**/api/study', route => route.fulfill({ json: { ...result, discovery: complete ? { ...result.discovery, testimonials: 'complete', videos: 'complete' } : result.discovery } }));
	const openStudy = async () => {
		await page.locator('#v16 .v').first().click({ button: 'right' });
		await page.getByRole('button', { name: 'More passage actions' }).click();
		await page.getByRole('menuitem', { name: /Go deeper/i }).click();
		await expect(page.getByRole('dialog', { name: 'Go deeper passage study' })).toBeVisible();
	};
	await openStudy();
	const folio = page.getByRole('dialog', { name: 'Go deeper passage study' });
	await folio.getByRole('button', { name: /^History/ }).click();
	await expect(folio.getByText('A contextual historical claim.')).toBeVisible();
	await expect(folio.getByText('Chapter context', { exact: true })).toBeVisible();
	await expect(folio.getByText(result.sources[0].excerpt)).toHaveCount(0);
	await expect(folio.getByText(result.guide[0].answer!)).toHaveCount(0);
	await folio.getByRole('button', { name: /^Academic/ }).click();
	await expect(folio.getByText(result.sources[0].excerpt)).toHaveCount(0);
	await expect(folio.getByText(result.guide[0].answer!)).toBeVisible();
	await expect(folio.getByText('Aquifer · CC BY-SA 4.0', { exact: true })).toBeVisible();
	await expect(folio.getByText('Paper search is not enabled.')).toBeVisible();
	await folio.getByRole('button', { name: /^Testimonials/ }).click();
	await expect(folio.getByText('Testimonial search is temporarily unavailable.')).toBeVisible();
	await expect(folio.getByText('No reviewed testimonials are available for this passage.')).toBeVisible();
	await folio.getByRole('button', { name: /^Videos/ }).click();
	await expect(folio.getByText('Video search is incomplete. Some results may be missing.')).toBeVisible();
	await folio.getByRole('button', { name: 'Close study' }).click();
	complete = true; await openStudy();
	await folio.getByRole('button', { name: /^Testimonials/ }).click();
	await expect(folio.getByText('No testimonials matched this passage.')).toBeVisible();
	expect(errors).toEqual([]);
	expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('deep research leads with a hook and reasoning, without repeating its source or generic guide summary', async ({ page }) => {
	const explanation = 'The grammatical form and the verb must be read together. A plural noun alone cannot establish how many actors the sentence describes.';
	await page.route('**/api/study', route => route.fulfill({ json: {
		reference:'John 3:16',passageText:'For God so loved the world.',contextText:'',
		sources:[{id:'note',title:'A grammatical note',author:'Aquifer',kind:'study_note',scope:'direct',tradition:null,url:'https://example.org/grammar',location:'John 3:16',license:'CC BY-SA 4.0',excerpt:'A source summary that should not appear twice.'}],
		claims:[{layer:'interpretation',title:'Why read the noun and verb together?',text:explanation,sourceIds:['note'],tradition:null}],
		guide:[{id:'contextualize',question:'',answer:'A generic summary of this reading.',sourceIds:['note']}],
		terms:[],papers:[],videos:[],testimonials:[],answer:null
	} }));
	await page.locator('#v16 .v').first().click({button:'right'});
	await page.getByRole('button',{name:'More passage actions'}).click();
	await page.getByRole('menuitem',{name:/Go deeper/i}).click();
	const folio=page.getByRole('dialog',{name:'Go deeper passage study'});
	await expect(folio.getByRole('heading',{level:3,name:'Why read the noun and verb together?'})).toBeVisible();
	await expect(folio.getByText(explanation,{exact:true})).toBeVisible();
	await expect(folio.locator('.items li')).toHaveCount(1);
	await expect(folio.getByText('A generic summary of this reading.')).toHaveCount(0);
	await expect(folio.getByRole('link',{name:'A grammatical note'})).toHaveAttribute('href','https://example.org/grammar');
	await expect(folio.getByText('Aquifer · CC BY-SA 4.0',{exact:true})).toBeVisible();
});

test('rejects another email, retires offline caches, and revokes logout sessions', async ({ page, browser }) => {
	const response = await page.request.post('/auth/login', { form: { email: 'other@example.com', password: 'local-test-password-only' }, headers: { origin: 'https://localhost:55141' }, maxRedirects: 0 });
	expect(response.headers().location).toBe('/sign-in?error=invalid');
	await page.evaluate(async () => { const cache = await caches.open('read-obsolete'); await cache.put('/read', new Response('old offline reader')); });
	await page.reload();
	await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain('read-obsolete');
	const state = await page.context().storageState();
	const logout = await page.request.post('/auth/logout', { headers: { origin: 'https://localhost:55141' }, maxRedirects: 0 });
	expect(logout.status()).toBe(303);
	const stale = await browser.newContext({ storageState: state });
	try { expect((await stale.request.get('https://localhost:55141/api/nlt?ref=John+3')).status()).toBe(401); } finally { await stale.close(); }
	await page.reload(); await expect(page).toHaveURL(/\/sign-in$/);
});

test('real Mark 6 evidence leaves History empty when AI is unavailable', async ({ page }) => {
 await page.goto('/read/web/mark/6');
 await expect(page.locator('.window')).toHaveAttribute('aria-busy', 'false');
 await page.locator('#v14 .v').first().click({ button: 'right' });
 await page.getByRole('button', { name: 'More passage actions' }).click();
 await page.getByRole('menuitem', { name: /Go deeper/i }).click();
 const folio = page.getByRole('dialog', { name: 'Go deeper passage study' });
 await expect(folio.getByRole('heading', { level: 2, name: 'Mark 6:14', exact: true })).toBeVisible();
 await expect(folio.getByText('AI explanations are unavailable right now. Sources and language data are still available.')).toBeVisible();
 await folio.getByRole('button', { name: /^History/ }).click();
 await expect(folio.locator('.items li')).toHaveCount(0);
 await folio.getByRole('button', { name: /^Academic/ }).click();
 await expect(folio.locator('.items li').filter({ hasText: 'repent and have faith' })).toHaveCount(1);
 await expect(folio.locator('.items li').filter({ hasText: 'repent and have faith' })).toContainText('CC BY-SA 4.0');
});
