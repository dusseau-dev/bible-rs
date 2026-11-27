// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import UpdateNotice from './UpdateNotice.svelte';
import { pwa, updateApp } from './pwa.svelte';

let notice: ReturnType<typeof mount> | undefined;
const worker = (postMessage = vi.fn()) => ({ state: 'installed', postMessage }) as unknown as ServiceWorker;
const button = (label: string) => [...document.querySelectorAll('button')].find(el => el.textContent === label)!;

afterEach(async () => {
	if (notice) await unmount(notice);
	notice = undefined;
	pwa.waiting = null;
	pwa.updating = false;
	pwa.updateError = '';
	pwa.error = '';
	document.body.innerHTML = '';
});

it('defers only the offered update, so a later release can be offered without reloading', () => {
	pwa.waiting = worker();
	notice = mount(UpdateNotice, { target: document.body });
	flushSync();
	button('Later').click();
	flushSync();
	expect(document.querySelector('[aria-label="App update"]')).toBeNull();
	pwa.waiting = worker();
	flushSync();
	expect(button('Reload to update')).toBeDefined();
	expect(pwa.updating).toBe(false);
});

it('keeps a failed update request retryable and tells the reader what happened', () => {
	const postMessage = vi.fn().mockImplementationOnce(() => { throw new Error('worker unavailable'); });
	pwa.waiting = worker(postMessage);
	notice = mount(UpdateNotice, { target: document.body });
	flushSync();
	expect(() => updateApp()).not.toThrow();
	flushSync();
	expect(button('Reload to update').disabled).toBe(false);
	expect(document.querySelector('[role="status"]')?.textContent).toMatch(/try again/i);
	updateApp();
	expect(postMessage).toHaveBeenCalledTimes(2);
	expect(pwa.updating).toBe(true);
});
