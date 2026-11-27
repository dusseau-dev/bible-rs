// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { ReadApp } from '../app.svelte';
import ScholarlyFolio from './ScholarlyFolio.svelte';
import { fixturePacket, fixtureDiscovery, fixtureLesson } from '../../server/study/discovery-fixtures';
let app: ReadApp;
vi.mock('../app.svelte', async original => ({ ...await original<typeof import('../app.svelte')>(), getApp: () => app }));
let component: ReturnType<typeof mount>;
afterEach(async () => { if (component) await unmount(component); vi.unstubAllGlobals(); document.body.innerHTML = ''; });
it('cancels old research and lesson requests when the selected passage changes', async () => {
 app = new ReadApp({ sections: [], translations: [], translation: 'kjv', chapter: 0, content: { index: 0, book: 1, chapter: 1, status: { type: 'ready' }, bookName: 'Genesis', bookTitle: 'Genesis', blocks: [] }, label: 'Genesis 1', short: 'Gen 1' });
 app.studyPassage = fixturePacket().passage;
 const result = { reference: 'Fixture passage', passageText: 'Fixture text', sources: fixturePacket().documents.map(d => d.source), terms: [], claims: [], guide: [], videos: [], papers: [], testimonials: [], discoveries: { packetId: 'first', evidenceVersion: '1', promptVersion: '1', research: fixturePacket().research, items: [fixtureDiscovery()] } };
 let finish!: (r: Response) => void;
 const fetcher = vi.fn().mockImplementation((url: string, _options?: RequestInit) => url.endsWith('/lesson') ? new Promise<Response>(resolve => finish = resolve) : Promise.resolve(new Response(JSON.stringify(result))));
 vi.stubGlobal('fetch', fetcher);
 component = mount(ScholarlyFolio, { target: document.body }); flushSync();
 await vi.waitFor(() => expect(document.querySelector('.expand')).not.toBeNull());
 (document.querySelector('.expand') as HTMLButtonElement).click(); flushSync();
 const signal = fetcher.mock.calls.find(c => c[0].endsWith('/lesson'))![1]!.signal as AbortSignal;
 app.studyPassage = { ...app.studyPassage!, chapter: 83 }; flushSync();
 await vi.waitFor(() => expect(fetcher.mock.calls.filter(c => c[0] === '/api/study')).toHaveLength(2));
 expect(signal.aborted).toBe(true);
 finish(new Response(JSON.stringify({ status: 'complete', lesson: fixtureLesson(), sources: [] })));
 await new Promise(r => setTimeout(r, 10)); flushSync(); expect(document.body.textContent).not.toContain('The payoff');
});
