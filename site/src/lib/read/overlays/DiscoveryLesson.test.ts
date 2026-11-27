// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import DiscoveryLesson from './DiscoveryLesson.svelte';
import DiscoveryImage from './DiscoveryImage.svelte';
import { fixtureLesson, fixturePacket } from '../../server/study/discovery-fixtures';
import { approvedImages } from '../../server/study/research-images';
const components: ReturnType<typeof mount>[] = [];
afterEach(async () => { for (const c of components) await unmount(c); components.length = 0; document.body.innerHTML = ''; });
it('renders escaped teaching prose, inline citations, accessible visual and reading exercise', () => {
 const lesson = fixtureLesson(); lesson.sections[0].units[0].text = '<script>danger()</script>';
 const target = document.createElement('div'); document.body.append(target);
 components.push(mount(DiscoveryLesson, { target, props: { lesson, sources: fixturePacket().documents.map(d => d.source) } })); flushSync();
 expect(target.querySelector('script')).toBeNull();
 expect(target.textContent).toContain('<script>danger()</script>');
 expect(target.querySelector('a')?.getAttribute('href')).toBe('/read');
 expect(target.querySelector('svg')?.getAttribute('role')).toBe('img');
 expect(target.textContent).toContain('The payoff'); expect(target.textContent).toContain('Who speaks?');
 expect(target.textContent).toContain('does not establish chronology');
});
it('keeps source, caption, provenance and license visible after an image fails', () => {
 const image = approvedImages({ book: 11, chapter: 18, firstVerse: 13, lastVerse: 16 }).images[0];
 const target = document.createElement('div'); document.body.append(target);
 components.push(mount(DiscoveryImage, { target, props: { image, sources: [] } })); flushSync();
 target.querySelector('img')!.dispatchEvent(new Event('error')); flushSync();
 expect(target.querySelector('img')).toBeNull(); expect(target.textContent).toContain('Image unavailable');
 expect(target.textContent).toContain('CC0 1.0'); expect(target.querySelector('a')?.href).toBe(image.sourceUrl);
});
