// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import DiscoveryList from './DiscoveryList.svelte';
import { fixtureDiscovery, fixtureLesson, fixturePacket } from '../../server/study/discovery-fixtures';
let component: ReturnType<typeof mount>;
afterEach(async () => { if (component) await unmount(component); vi.unstubAllGlobals(); vi.useRealTimers(); document.body.innerHTML = ''; });
function open() {
 const packet = fixturePacket(), first = fixtureDiscovery(), second = { ...first, id: '33333333-3333-4333-8333-333333333333', title: { ...first.title, text: 'Second discovery' } };
 component = mount(DiscoveryList, { target: document.body, props: { bundle: { packetId: 'packet', promptVersion: '1', evidenceVersion: '1', items: [first, second], research: packet.research }, passage: packet.passage, sources: packet.documents.map(d => d.source) } }); flushSync();
 return [...document.querySelectorAll<HTMLButtonElement>('.expand')];
}
it('loads only on expansion, reuses a completed lesson and restores collapse focus', async () => {
 const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'complete', lesson: fixtureLesson(), sources: fixturePacket().documents.map(d => d.source) })));
 vi.stubGlobal('fetch', fetcher); const buttons = open(); expect(fetcher).not.toHaveBeenCalled();
 buttons[0].click(); await vi.waitFor(() => expect(document.body.textContent).toContain('The payoff'));
 document.querySelector<HTMLButtonElement>('.collapse')!.click(); await vi.waitFor(() => expect(document.activeElement).toBe(buttons[0]));
 buttons[0].click(); flushSync(); expect(fetcher).toHaveBeenCalledOnce();
 expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
});
it('ignores a late response after another discovery is opened, retaining both previews', async () => {
 let finish!: (r: Response) => void;
 const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => finish = resolve)).mockResolvedValueOnce(new Response(JSON.stringify({ status: 'insufficient', message: 'Not enough evidence.' })));
 vi.stubGlobal('fetch', fetcher); const buttons = open(); buttons[0].click(); flushSync(); buttons[1].click();
 await vi.waitFor(() => expect(document.body.textContent).toContain('Not enough evidence.'));
 finish(new Response(JSON.stringify({ status: 'complete', lesson: fixtureLesson(), sources: [] })));
 await new Promise(resolve => setTimeout(resolve, 10)); flushSync();
 expect(document.body.textContent).not.toContain('The payoff');
 expect(buttons[0].getAttribute('aria-expanded')).toBe('false'); expect(buttons).toHaveLength(2);
 expect((fetcher.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
});

it('bounds pending polling and offers an explicit retry', async () => {
 vi.useFakeTimers();
 const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ status: 'pending', message: 'Preparing' }), { status: 202, headers: { 'retry-after': '2' } }));
 vi.stubGlobal('fetch', fetcher); const buttons = open(); buttons[0].click(); flushSync();
 await vi.advanceTimersByTimeAsync(60_010); flushSync();
 expect(fetcher).toHaveBeenCalledTimes(30);
 expect(document.body.textContent).toContain('Retry lesson');
 expect(document.body.textContent).toContain('taking longer than expected');
});
