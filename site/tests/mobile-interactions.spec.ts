import { test, expect, type Page, type Locator } from '@playwright/test';
import { existsSync, readFileSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

const authFile = resolve('playwright/.auth/qa-user.json');
// Mocked provider responses must bypass WebKit's worker network process; app-pwa.spec.ts
// separately exercises the real service worker in each browser.
test.use({ actionTimeout:10_000, serviceWorkers:'block' });
let runtimeErrors:string[]=[];
const press = async (target: Locator) => {
	if (await target.page().evaluate(() => matchMedia('(pointer:coarse)').matches)) await target.tap();
	else await target.click();
};
async function fits(target: Locator) {
	await expect(target).toBeVisible();
	const box = (await target.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(-1);
	expect(box.x + box.width).toBeLessThanOrEqual(target.page().viewportSize()!.width + 1);
	expect(await target.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
}
async function openPage(page: Page, name: RegExp) {
	const sidebar = page.locator('aside.sidebar');
	if (!await sidebar.evaluate(el => el.classList.contains('shown')))
		await press(page.getByRole('main').getByRole('button', { name:/Show sidebar/ }));
	await press(page.getByRole('navigation', {name:'Sidebar', exact:true}).getByRole('button', {name:new RegExp(name.source.replace(/\$$/, '(?: \\d+)?$'))}));
	// Depending on the active page, the toolbar may yield its toggle to the sidebar.
	if (page.viewportSize()!.width <= 700) {
		const toolbarToggle = page.getByRole('main').locator('.toggle:not(.away)').getByRole('button', {name:/Hide sidebar/});
		await press(await toolbarToggle.count() ? toolbarToggle : sidebar.getByRole('button', {name:/Hide sidebar/}));
	}
}
async function selectVerse(page: Page) {
	if (page.viewportSize()!.width <= 700 && await page.locator('aside.sidebar').evaluate(el=>el.classList.contains('shown')))
		await press(page.getByRole('main').getByRole('button',{name:/Hide sidebar/}));
	if (await page.getByRole('dialog', {name:'Selected passage actions'}).isVisible()) return;
	const verse = page.locator('#v16 .v').first();
	await verse.scrollIntoViewIfNeeded();
	if (await page.evaluate(() => matchMedia('(pointer:coarse)').matches)) await verse.tap();
	else await verse.click({button:'right'});
	await expect(page.getByRole('dialog', {name:'Selected passage actions'})).toBeVisible();
}
async function more(page: Page) {
	await selectVerse(page);
	await press(page.getByRole('button', {name:'More passage actions'}));
	await expect(page.getByRole('menu', {name:'Verse', exact:true})).toBeVisible();
	const menuBox=(await page.getByRole('menu',{name:'Verse',exact:true}).boundingBox())!;
	expect(menuBox.height).toBeLessThanOrEqual(Math.min(540,page.viewportSize()!.height*0.6)+1);
}

test.beforeEach(async ({page, context}) => {
	runtimeErrors=[]; page.on('pageerror',error=>runtimeErrors.push(error.message));
	if (existsSync(authFile)) await context.addCookies(JSON.parse(readFileSync(authFile, 'utf8')).cookies);
	await page.goto('/read/kjv/john/3');
	if (new URL(page.url()).pathname === '/sign-in') {
		await page.getByLabel('Email', {exact:true}).fill('mark@dusseauand.com');
		await page.getByLabel('Password', {exact:true}).fill('local-test-password-only');
		await page.getByRole('button', {name:'Sign in', exact:true}).click();
		await expect(page.locator('.window')).toHaveAttribute('aria-busy','false');
		await page.goto('/read/kjv/john/3');
		mkdirSync(resolve('playwright/.auth'), {recursive:true,mode:0o700});
		await context.storageState({path:authFile}); chmodSync(authFile,0o600);
	}
	await expect(page.locator('.window')).toHaveAttribute('aria-busy','false');
});
test.afterEach(() => expect(runtimeErrors).toEqual([]));

test('sidebar navigation and chapter links provide finger-sized targets', async ({page,isMobile}) => {
	test.skip(!isMobile, 'Touch target sizing is specific to coarse pointers.');
	const sidebar = page.locator('aside.sidebar');
	if (!await sidebar.evaluate(el => el.classList.contains('shown')))
		await press(page.getByRole('main').getByRole('button', {name:/Show sidebar/}));
	const chapter = sidebar.getByRole('link', {name:'John 2', exact:true});
	for (const target of [sidebar.getByRole('button', {name:'Bookmarks', exact:true}), chapter]) {
		await expect(target).toBeVisible();
		const box = (await target.boundingBox())!;
		expect.soft(box.height).toBeGreaterThanOrEqual(44);
		expect.soft(box.width).toBeGreaterThanOrEqual(44);
	}
	await press(chapter);
	await expect(chapter).toHaveAttribute('aria-current','true');
});

test('text controls have usable touch targets and reserve hover feedback for a mouse', async ({page,isMobile}) => {
	if (isMobile) {
		await press(page.getByRole('button', {name:'More', exact:true}));
		await press(page.getByRole('menuitem', {name:/^Text & Layout/}));
	} else await press(page.getByRole('button', {name:/^Text & layout/}));
	const panel = page.getByRole('dialog', {name:'Text & layout', exact:true});
	await expect(panel).toBeVisible();
	const bigger = panel.getByRole('button', {name:'A+', exact:true});
	const before = await bigger.evaluate(el => getComputedStyle(el).backgroundColor);
	// Move a pointer over the control even in the touch context: capability-gated
	// CSS must not paint a hover state on that context. Physical tap feel is separate.
	await bigger.hover();
	if (isMobile) {
		expect.soft(await bigger.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(before);
		for (const target of [bigger, panel.locator('label.checkbox').first()]) {
			const box = (await target.boundingBox())!;
			expect.soft(box.height).toBeGreaterThanOrEqual(44);
			expect.soft(box.width).toBeGreaterThanOrEqual(44);
		}
	} else await expect.poll(() => bigger.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(before);
	const previous = await panel.locator('.pt').textContent();
	await press(bigger);
	await expect(panel.locator('.pt')).not.toHaveText(previous!);
	const checkbox = panel.getByRole('checkbox', {name:'Justify paragraphs', exact:true});
	const checked = await checkbox.isChecked();
	await press(panel.locator('label.checkbox').filter({hasText:'Justify paragraphs'}));
	await expect(checkbox).toBeChecked({checked:!checked});
});

test('passage toolbar, definitions, overflow destinations and recoverable errors', async ({page}) => {
	test.setTimeout(90_000);
	const errors:string[]=[]; page.on('pageerror', e=>errors.push(e.message));
	const requests:Record<string,unknown>[]=[];
	let fail=false;
	await page.route('**/api/study', async route=>{
		requests.push(route.request().postDataJSON());
		await route.fulfill(fail ? {status:503,json:{error:'Study is temporarily unavailable. Try again later.'}} : {json:{
			reference:'John 3:16', passageText:'For God so loved the world.', contextText:'', sources:[], terms:[], claims:[], papers:[], videos:[], testimonials:[], guide:[], answer:{text:'A definition grounded in this passage.',sourceIds:[]},
			discovery:{sources:'complete',papers:'disabled',testimonials:'failed',videos:'complete'}
		}});
	});
	await selectVerse(page);
	const toolbar=page.getByRole('dialog',{name:'Selected passage actions'});
	await fits(toolbar);
	const buttons=toolbar.locator('.row > button');
	const ys=await buttons.evaluateAll(els=>els.map(el=>Math.round(el.getBoundingClientRect().y)));
	expect(new Set(ys).size).toBe(1);
	await press(toolbar.getByRole('button',{name:'Define',exact:true}));
	await expect(page.getByText('A definition grounded in this passage.')).toBeVisible();
	expect(requests.at(-1)).toMatchObject({mode:'ask',question:'Define the key words in this passage as this author uses them in context.'});
	await press(page.getByRole('dialog',{name:'Passage define'}).getByRole('button',{name:'Close',exact:true}));
	for (const [label, category] of [['History','History'],['Related','Related'],['Research','Academic'],['Testimonials','Testimonials'],['Sermons','Videos']]) {
		await more(page);
		await expect(toolbar.getByRole('button',{name:'More passage actions'})).toHaveAttribute('aria-expanded','true');
		await press(page.getByRole('menuitem',{name:label,exact:true}));
		const folio=page.getByRole('dialog',{name:'Go deeper passage study'});
		await expect(folio.getByRole('button',{name:new RegExp(`^${category}`)})).toHaveAttribute('aria-pressed','true');
		await fits(folio);
		await press(folio.getByRole('button',{name:'Close study'}));
	}
	await more(page); await press(page.getByRole('menuitem',{name:'Simplify',exact:true}));
	await expect(page.getByRole('dialog',{name:'Passage simplify'})).toBeVisible();
	expect(requests.at(-1)).toMatchObject({mode:'explain',style:'simple'});
	await press(page.getByRole('dialog',{name:'Passage simplify'}).getByRole('button',{name:'Close',exact:true}));
	fail=true; await selectVerse(page); await press(toolbar.getByRole('button',{name:'Explain',exact:true}));
	await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
	fail=false; await press(page.getByRole('button',{name:'Retry',exact:true}));
	await expect(page.getByText('A definition grounded in this passage.')).toBeVisible();
	expect(errors).toEqual([]);
});

test('collections fit phones and notes survive editing, filtering and navigation', async ({page,isMobile}) => {
	test.setTimeout(90_000);
	if (isMobile) {
		for (const size of [{width:360,height:780},{width:430,height:932},{width:844,height:390}]) {
			await page.setViewportSize(size);
			for (const name of ['Bookmarks','Highlights','Notes','History','Reading Plans','Translations']) {
				await openPage(page,new RegExp(`^${name}`)); await fits(page.locator('.pages'));
			}
		}
		await page.setViewportSize({width:390,height:844});
	}
	for (const name of ['Bookmarks','Highlights','Notes','History']) {
		await openPage(page,new RegExp(`^${name}$`)); await fits(page.locator('.pages'));
	}
	await page.goto('/read/kjv/john/3'); await expect(page.locator('.window')).toHaveAttribute('aria-busy','false');
	await more(page); await press(page.getByRole('menuitem',{name:/^Bookmark/}));
	await selectVerse(page); await press(page.getByRole('button',{name:'Choose highlight color'}));
	await press(page.getByRole('button',{name:'Yellow highlight',exact:true}));
	await press(page.getByRole('button',{name:'Add or edit note'}));
	await page.getByRole('textbox',{name:'Note',exact:true}).fill('A saved mobile study note');
	await press(page.getByRole('button',{name:'Done',exact:true}));
	await openPage(page,/^Notes$/);
	await press(page.locator('.list-pane').getByRole('button').filter({hasText:'John 3:16'}));
	await fits(page.locator('.editor-pane'));
	await press(page.getByRole('textbox',{name:'Note on John 3:16'}));
	await page.locator('textarea[aria-label="Note on John 3:16"]').fill('Edited mobile note');
	if (isMobile) await press(page.getByRole('button',{name:'Back to notes'}));
	await openPage(page,/^Highlights$/); await fits(page.locator('.pages'));
	await press(page.getByRole('tab',{name:/^Yellow/}));
	await expect(page.locator('.pages').getByRole('button',{name:'John 3:16',exact:true})).toBeVisible();
	await openPage(page,/^Bookmarks$/); await fits(page.locator('.pages'));
	const download=page.waitForEvent('download'); await press(page.getByRole('button',{name:'Export',exact:true}));
	expect((await download).suggestedFilename()).toMatch(/\.md$/);
	await page.reload(); await expect(page.locator('.window')).toHaveAttribute('aria-busy','false');
	await openPage(page,/^Notes$/);
	await expect(page.locator('.list-pane')).toContainText('Edited mobile note');
});

test('reading plan creation, daily progress, reflection and deletion', async ({page}) => {
	test.setTimeout(90_000);
	await openPage(page,/^Reading Plans$/);
	await fits(page.locator('.pages'));
	await press(page.getByRole('button',{name:'New plan',exact:true}));
	await page.getByLabel('Title',{exact:true}).fill('Mobile QA plan');
	await page.getByLabel('Description',{exact:true}).fill('Two days of John');
	await page.getByLabel('Passages',{exact:true}).fill('John 1–2');
	await press(page.getByRole('button',{name:'Fill days',exact:true}));
	await expect(page.getByLabel('Day 2 passages')).toBeVisible();
	await fits(page.locator('.pages'));
	await press(page.getByRole('button',{name:'Save plan',exact:true}));
	await expect(page.getByRole('heading',{name:'Mobile QA plan'})).toBeVisible();
	await press(page.locator('.mine-card').getByRole('button',{name:'Start',exact:true}));
	await fits(page.locator('.pages'));
	await press(page.locator('.hero-title').filter({hasText:'Mobile QA plan'}));
	await fits(page.locator('.pages'));
	await expect(page.getByRole('heading',{name:/^Day 1/})).toBeVisible();
	const completion=page.getByRole('checkbox').first(); await press(completion);
	await expect(completion).toHaveAttribute('aria-checked','true');
	await page.getByRole('textbox',{name:/Reflection/}).fill('A reflection from phone QA');
	await press(page.getByRole('button',{name:'Save',exact:true}));
	await page.reload(); await expect(page.locator('.window')).toHaveAttribute('aria-busy','false');
	await openPage(page,/^Reading Plans$/);
	await press(page.getByRole('tab',{name:/^My Plans/}));
	await press(page.locator('.mine-card').getByRole('button',{name:'Edit',exact:true}));
	await press(page.getByRole('button',{name:'Delete this plan',exact:true}));
	await press(page.getByRole('button',{name:'Delete plan',exact:true}));
	await expect(page.getByRole('heading',{name:'Mobile QA plan'})).toHaveCount(0);
});

test('translation library filters, imports public domain text and removes it', async ({page}) => {
	test.setTimeout(90_000);
	await openPage(page,/^Translations/); await fits(page.locator('.pages'));
	await page.getByRole('searchbox',{name:'Filter translations'}).fill('World');
	await expect(page.getByRole('listbox',{name:'Translations'}).getByRole('option')).toHaveCount(1);
	await page.getByRole('searchbox',{name:'Filter translations'}).fill('');
	await press(page.getByRole('button',{name:'Import…',exact:true}));
	const importer=page.getByRole('dialog',{name:'Import a Translation'}); await fits(importer);
	const chooser=page.waitForEvent('filechooser'); await press(importer.getByRole('button',{name:'Choose File…'}));
	await (await chooser).setFiles({name:'qa.usfm',mimeType:'text/plain',buffer:Buffer.from('\\id JHN QA\n\\h John\n\\c 1\n\\p\n\\v 1 In the beginning was the Word, and the Word was with God, and the Word was God.\n')});
	await importer.getByLabel('Abbreviation',{exact:true}).fill('QA');
	await importer.getByLabel('Name',{exact:true}).fill('Public domain QA sample');
	await press(importer.getByRole('button',{name:'Import',exact:true}));
	const review=page.getByRole('dialog',{name:'Import finished with problems'});
	await expect(review).toBeVisible(); await fits(review);
	await press(review.getByRole('button',{name:'Add to Library',exact:true}));
	await openPage(page,/^Translations/);
	await press(page.getByRole('tab',{name:/^Imported/}));
	await expect(page.getByRole('option').filter({hasText:'Public domain QA sample'})).toBeVisible();
	await press(page.getByRole('button',{name:'More for Public domain QA sample'}));
	await press(page.getByRole('menuitem',{name:'Remove…'}));
	await expect(page.getByRole('option').filter({hasText:'Public domain QA sample'})).toHaveCount(0);
});

test('sharing generates an image and exposes every control on narrow screens', async ({page}) => {
	test.setTimeout(60_000);
	await more(page); await press(page.getByRole('menuitem',{name:'Share as Image…'}));
	const sheet=page.getByRole('dialog',{name:'Share John 3:16'}); await fits(sheet);
	for (const shape of ['Square','Portrait','Wide']) {
		await press(sheet.getByRole('radio',{name:shape,exact:true})); await fits(sheet.locator('.body'));
	}
	await press(sheet.getByRole('radio',{name:'Sepia',exact:true}));
	const download=page.waitForEvent('download'); await press(sheet.getByRole('button',{name:'Save Image…'}));
	expect((await download).suggestedFilename()).toMatch(/John[ _]3\.16\.png/);
	await press(sheet.getByRole('button',{name:'Close sharing'})); await expect(sheet).toHaveCount(0);
});

test('all settings tabs, theme persistence, backup export and import', async ({page,isMobile}) => {
	test.setTimeout(90_000);
	async function settings() {
		if (isMobile) { await press(page.getByRole('button',{name:'More',exact:true})); await press(page.getByRole('menuitem',{name:'Settings',exact:true})); }
		else await page.keyboard.press('ControlOrMeta+,');
	}
	await settings(); const sheet=page.getByRole('dialog',{name:'Settings',exact:true});
	for (const tab of ['Reading','Appearance','Translations','Shortcuts','Data','About']) {
		await press(sheet.getByRole('tab',{name:tab,exact:true})); await fits(sheet); await fits(sheet.getByRole('tabpanel'));
	}
	await press(sheet.getByRole('tab',{name:'Appearance',exact:true}));
	await press(sheet.getByRole('radio',{name:'Sepia',exact:true}));
	await expect(page.locator('html')).toHaveAttribute('data-theme','sepia');
	await press(sheet.getByRole('tab',{name:'Data',exact:true}));
	const download=page.waitForEvent('download'); await press(sheet.getByRole('button',{name:'Export…',exact:true}).nth(1));
	const file=await download; expect(file.suggestedFilename()).toMatch(/\.json$/);
	const chooser=page.waitForEvent('filechooser'); await press(sheet.getByRole('button',{name:'Import Backup…'}));
	await (await chooser).setFiles((await file.path())!);
	await press(sheet.getByRole('button',{name:'Close Settings'}));
	await page.reload(); await expect(page.locator('.window')).toHaveAttribute('aria-busy','false');
	await expect(page.locator('html')).toHaveAttribute('data-theme','sepia');
});

test('public support and privacy, topic and book indexes remain reachable on phone widths', async ({page}) => {
	test.setTimeout(90_000);
	for (const path of ['/privacy','/support','/topics','/topics/love','/read/kjv','/read/kjv/john','/read/kjv/john/3/16']) {
		const response=await page.goto(path); expect(response?.status(),path).toBe(200);
		expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path).toBe(true);
		await expect(page.locator('h1').first()).toBeVisible();
	}
});

test('search results, empty searches, comparison and parallel translation controls', async ({page,isMobile}) => {
	test.setTimeout(60_000);
	if (isMobile) await press(page.getByRole('button',{name:/^Search \(/}));
	const search=page.getByRole('searchbox',{name:'Search',exact:true});
	await search.fill('zzzzunmatchedword');
	await expect(page.getByText('No verses match', {exact:true})).toBeVisible();
	await search.fill('love');
	await expect(page.locator('.results .entry button').first()).toBeVisible();
	await press(page.getByRole('radio',{name:'New Testament',exact:true}));
	await press(page.locator('.results .entry button').first());
	if (isMobile) {
		const toolbarToggle = page.getByRole('main').locator('.toggle:not(.away)').getByRole('button', {name:/Hide sidebar/});
		await press(await toolbarToggle.count() ? toolbarToggle : page.locator('aside.sidebar').getByRole('button', {name:/Hide sidebar/}));
	}
	const navigation = page.getByRole('group', {name:'Search results', exact:true});
	const next = navigation.getByRole('button', {name:'Next search result', exact:true});
	const previous = navigation.getByRole('button', {name:'Previous search result', exact:true});
	await expect(next).toBeVisible();
	if (isMobile) for (const target of [next, previous]) {
		const box = (await target.boundingBox())!;
		expect(box.width).toBeGreaterThanOrEqual(44);
		expect(box.height).toBeGreaterThanOrEqual(44);
	}
	const position = navigation.locator('[aria-live="polite"]');
	const first = await position.textContent();
	await press(next);
	await expect(position).not.toHaveText(first!);
	await press(previous);
	await expect(position).toHaveText(first!);
	await page.goto('/read/kjv/john/3'); await expect(page.locator('.window')).toHaveAttribute('aria-busy','false');
	await more(page); await press(page.getByRole('menuitem',{name:/^Compare Translations/}));
	const comparison=page.getByRole('dialog',{name:'Compare John 3:16'});
	await fits(comparison);
	await press(comparison.getByRole('button',{name:'Open in Parallel'}));
	// Compare includes as many translations as fit; phones show fewer than desktop.
	await expect(page.locator('.cols .pick').nth(1)).toBeVisible();
	// Up to four columns are visible; removing one can reveal another selected
	// translation. Keep removing until the original single-column reader returns.
	for (let n=0; n<7 && await page.locator('.cols .pick').count(); n++) {
		const before=await page.locator('.cols .pick').allTextContents();
		await press(page.locator('.cols .pick').last());
		await press(page.getByRole('menuitem',{name:'Remove column',exact:true}));
		await expect.poll(()=>page.locator('.cols .pick').allTextContents()).not.toEqual(before);
	}
	await expect(page.locator('.cols .pick')).toHaveCount(0);
});

test('onboarding is touch accessible and describes the private online reader accurately', async ({page}) => {
	await page.goto('/read');
	const welcome=page.getByRole('dialog',{name:'Welcome to Bible'});
	await expect(welcome).toBeVisible(); await fits(welcome);
	await expect(welcome).toContainText('internet required');
	await press(welcome.getByRole('button',{name:'Continue',exact:true}));
	await press(welcome.getByRole('radio',{name:'Sepia',exact:true}).last());
	await press(welcome.getByRole('button',{name:'Continue',exact:true}));
	await expect(welcome).toHaveCount(0);
	await expect(page.locator('html')).toHaveAttribute('data-theme','sepia');
});

test('command palette and shortcut help fit a phone and can be closed without Escape', async ({page}) => {
	await page.keyboard.press('ControlOrMeta+k');
	const palette=page.getByRole('dialog',{name:'Go to, search or run a command'});
	await fits(palette);
	await palette.getByRole('combobox').fill('John 3:16');
	await expect(palette.getByRole('option').first()).toContainText('John 3:16');
	await press(palette.getByRole('button',{name:'Close commands'}));
	await expect(palette).toHaveCount(0);
	// The command shortcut also works when focus returns to the toolbar search field.
	await page.keyboard.press('ControlOrMeta+/');
	const shortcuts=page.getByRole('dialog',{name:'Keyboard Shortcuts'});
	await fits(shortcuts); await fits(shortcuts.locator('.body'));
	await shortcuts.getByRole('textbox',{name:'Filter shortcuts'}).fill('bookmark');
	await expect(shortcuts.locator('.body')).toContainText('Bookmark');
	await press(shortcuts.getByRole('button',{name:'Close',exact:true}));
});

test('Ark pages expose dimensions and part controls, including the embedded view', async ({page}) => {
	test.setTimeout(60_000);
	for (const path of ['/ark-of-the-covenant','/ark-of-the-covenant/embed']) {
		const response=await page.goto(path); expect(response?.status()).toBe(200);
		const viewer=page.getByRole('region',{name:'Ark of the Covenant in 3D'});
		await expect(viewer).toBeVisible();
		expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
		await press(page.getByRole('switch',{name:'See inside'}));
		await expect(page.getByRole('switch',{name:'See inside'})).toHaveAttribute('aria-checked','true');
		await press(page.locator('.panel .parts button').first());
		await expect(page.getByRole('button',{name:'All dimensions'})).toBeVisible();
		await press(page.getByRole('button',{name:'All dimensions'}));
	}
});

test('passage study surfaces follow the selected reader theme', async ({page}) => {
	test.setTimeout(90_000);
	await page.route('**/api/study', route=>route.fulfill({json:{
		reference:'John 3:16', passageText:'For God so loved the world.', contextText:'',
		sources:[{id:'verse',title:'John 3:16',author:'World English Bible',license:'Public domain',kind:'scripture',scope:'direct',url:'https://ebible.org/web/JHN03.htm',excerpt:'For God so loved the world.'}],
		terms:[], claims:[{layer:'text',text:'Read this verse alongside its chapter context.',sourceIds:['verse'],tradition:null}], papers:[], videos:[], testimonials:[],
		guide:[],
		answer:{text:'Read the words in their chapter context.',sourceIds:['verse']},
		discovery:{sources:'complete',papers:'disabled',testimonials:'complete',videos:'complete'}
	}}));
	for (const [theme,surface,ink] of [
		['Light','rgb(255, 255, 255)','rgb(28, 29, 33)'],
		['Sepia','rgb(251, 245, 232)','rgb(58, 46, 34)'],
		['Dark','rgb(38, 38, 42)','rgb(230, 227, 220)']
	]) {
		await page.keyboard.press('ControlOrMeta+,');
		const settings=page.getByRole('dialog',{name:'Settings',exact:true});
		await press(settings.getByRole('tab',{name:'Appearance',exact:true}));
		await press(settings.getByRole('radio',{name:theme,exact:true}));
		await press(settings.getByRole('button',{name:'Close Settings'}));
		await more(page);
		const toolbar=page.getByRole('dialog',{name:'Selected passage actions'});
		const menu=page.getByRole('menu',{name:'Verse',exact:true});
		await expect(toolbar).toHaveCSS('background-color',surface);
		await expect(menu).toHaveCSS('background-color',surface);
		await press(menu.getByRole('menuitem',{name:'Go deeper',exact:true}));
		const folio=page.getByRole('dialog',{name:'Go deeper passage study'});
		await expect(folio.locator('.item-text')).toContainText('chapter context');
		await expect(folio).toHaveCSS('background-color',surface);
		await expect(folio).toHaveCSS('color',ink);
		await expect(folio.locator('.chips')).toHaveCSS('background-color',surface);
		const active=folio.getByRole('button',{name:/^All/});
		const activeColor=await active.evaluate(el=>getComputedStyle(el).backgroundColor);
		await active.hover();
		await expect(active).toHaveCSS('background-color',activeColor);
		await press(folio.getByRole('button',{name:'Close study'}));
		await selectVerse(page);
		await press(toolbar.getByRole('button',{name:/^Ask/}));
		const quick=page.getByRole('dialog',{name:'Passage ask'});
		await expect(quick).toHaveCSS('background-color',surface);
		await expect(quick.locator('.card')).toHaveCSS('color',ink);
		await press(quick.getByRole('button',{name:'Close',exact:true}));
	}
});

test('shorts posters load, open YouTube and keep failed previews usable', async ({page,context}) => {
	test.setTimeout(60_000);
	await page.route('https://i.ytimg.com/vi/jQm8ElP8Kj0/hqdefault.jpg', route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#34516b"/></svg>'}));
	await page.route('https://i.ytimg.com/vi/WTL3mrkoeEI/hqdefault.jpg', route=>route.fulfill({status:404,body:''}));
	await context.route('https://www.youtube.com/shorts/**',route=>route.fulfill({contentType:'text/html',body:'<title>YouTube destination</title>'}));
	await page.route('**/api/study',route=>route.fulfill({json:{
		reference:'John 3:16',passageText:'For God so loved the world.',contextText:'',sources:[],terms:[],claims:[],guide:[],papers:[],testimonials:[],
		videos:[
			{id:'jQm8ElP8Kj0',platform:'youtube',title:'Featured teaching',channel:'Teaching channel',url:'https://www.youtube.com/shorts/jQm8ElP8Kj0',scope:'direct',verification:'video link only',durationSeconds:165,reviewed:true},
			{id:'WTL3mrkoeEI',platform:'youtube',title:'Another teaching',channel:'Teaching channel',url:'https://www.youtube.com/shorts/WTL3mrkoeEI',scope:'context',verification:'video link only',durationSeconds:120,reviewed:false}
		],discovery:{sources:'complete',papers:'complete',testimonials:'complete',videos:'complete'}
	}}));
	await page.keyboard.press('ControlOrMeta+,');
	const settings=page.getByRole('dialog',{name:'Settings',exact:true});
	await press(settings.getByRole('tab',{name:'Appearance',exact:true}));
	await press(settings.getByRole('radio',{name:'Dark',exact:true}));
	await press(settings.getByRole('button',{name:'Close Settings'}));
	await more(page); await press(page.getByRole('menuitem',{name:'Sermons',exact:true}));
	const folio=page.getByRole('dialog',{name:'Go deeper passage study'});
	const featured=folio.getByRole('article',{name:'1 of 2: Featured teaching'});
	await expect.poll(()=>featured.locator('img').evaluate((el:HTMLImageElement)=>el.complete && el.naturalWidth===480)).toBe(true);
	await fits(featured.locator('.card'));
	const box=(await featured.locator('.card').boundingBox())!;
	expect(box.height/box.width).toBeCloseTo(16/9,1);
	const popup=context.waitForEvent('page'); await press(featured.getByRole('link',{name:'Open on YouTube (opens in a new tab)',exact:true}));
	const destination=await popup;
	await expect(destination).toHaveURL('https://www.youtube.com/shorts/jQm8ElP8Kj0');
	await destination.close();
	await press(folio.getByRole('button',{name:/^All/}));
	const shelf=folio.getByRole('region',{name:'Shorts',exact:true});
	await expect(shelf.getByRole('button',{name:'Watch Featured teaching',exact:true}).locator('img')).toBeVisible();
	const missing=shelf.getByRole('button',{name:'Watch Another teaching',exact:true});
	await missing.scrollIntoViewIfNeeded();
	await expect(missing.locator('img')).toHaveCount(0);
	await expect(missing).toContainText('Another teaching');
	await press(missing);
	const fallback=folio.getByRole('article',{name:'2 of 2: Another teaching'});
	await expect(fallback).toBeInViewport({ratio:0.9});
	await expect(fallback).toContainText('Teaching channel · 2:00');
	await expect(fallback.getByRole('link',{name:'Open on YouTube (opens in a new tab)',exact:true})).toHaveAttribute('href','https://www.youtube.com/shorts/WTL3mrkoeEI');
});

test('generated note credits are consolidated below the notes and collapsed by default', async ({page}) => {
	await page.route('**/api/study',route=>route.fulfill({json:{
		reference:'John 3:16',passageText:'For God so loved the world.',contextText:'',terms:[],guide:[],papers:[],testimonials:[],videos:[],
		sources:[
			{id:'notes',title:'Study notes',author:'Aquifer Open Study Notes · Mission Mutual',license:'CC BY-SA 4.0',kind:'study_note',scope:'context',url:'https://example.org/notes',excerpt:'A study note.'},
			{id:'words',title:'Greek words',author:'Tyndale House Cambridge / STEPBible',license:'CC BY 4.0',kind:'study_note',scope:'context',url:'https://example.org/words',excerpt:'A language note.'}
		],
		claims:[
			{layer:'language',title:'Words in context',text:'Read the words in their chapter context.',sourceIds:['notes','words'],tradition:null},
			{layer:'interpretation',title:'A second note',text:'Compare the surrounding verses.',sourceIds:['notes','words'],tradition:null}
		],discovery:{sources:'complete',papers:'complete',testimonials:'complete',videos:'complete'}
	}}));
	await more(page);await press(page.getByRole('menuitem',{name:'Go deeper',exact:true}));
	const folio=page.getByRole('dialog',{name:'Go deeper passage study'});
	await expect(folio.locator('.item-text')).toHaveCount(2);
	await expect(folio.locator('.items')).not.toContainText('CC BY');
	await expect(folio.locator('.items')).toContainText('Chapter context');
	await expect(folio.getByRole('link',{name:/Study notes/}).first()).toBeVisible();
	const credits=folio.locator('details.credits');
	await expect(credits).not.toHaveAttribute('open');
	await expect(credits.locator('li')).toHaveCount(2);
	await expect(credits.locator('li').first()).not.toBeVisible();
	await press(credits.locator('summary'));
	await expect(credits.locator('li').first()).toBeVisible();
	await expect(credits).toContainText('Aquifer Open Study Notes · Mission Mutual · CC BY-SA 4.0');
	await expect(credits).toContainText('Tyndale House Cambridge / STEPBible · CC BY 4.0');
	await credits.locator('summary').focus();
	await page.keyboard.press('Space');
	await expect(credits.locator('li').first()).not.toBeVisible();
});
