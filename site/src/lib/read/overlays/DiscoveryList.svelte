<script lang="ts">
 import { onDestroy, tick } from 'svelte';
 import type { DiscoveryBundle, LessonResponse } from '../discoveries';
 import type { StudyPassage, StudySource } from '../study';
 import type { Category } from '../study-items';
 import { BOOKS } from '../books';
 import DiscoveryLesson from './DiscoveryLesson.svelte';
 import CitedUnit from './CitedUnit.svelte';
 let { bundle, passage, sources, filter = 'all', onrefresh }: { bundle: DiscoveryBundle; passage: StudyPassage; sources: StudySource[]; filter?: Category | 'all'; onrefresh?: () => void } = $props();
 type Entry = { loading: boolean; result?: LessonResponse; scroll: number };
 let entries = $state<Record<string, Entry>>({}), expanded = $state<string | null>(null);
 let root: HTMLElement;
 let controller: AbortController | null = null, generation = 0, identity = '';
 const buttons = new Map<string, HTMLButtonElement>();
 const visible = $derived(bundle.items.filter(d => filter === 'all' || d.category === filter));
 const reference = $derived(`${BOOKS[passage.book].name} ${passage.chapter}:${passage.firstVerse}${passage.lastVerse > passage.firstVerse ? `–${passage.lastVerse}` : ''}`);
 const scrollArea = () => root?.closest<HTMLElement>('.content');
 const stop = () => { controller?.abort(); controller = null; generation++; if (expanded && entries[expanded]) entries[expanded].loading = false; };
 const remember = () => { if (expanded && entries[expanded]) entries[expanded].scroll = scrollArea()?.scrollTop ?? 0; };
 $effect(() => {
  const next = `${bundle.packetId}:${bundle.evidenceVersion}:${JSON.stringify(passage)}`;
  if (identity !== next) { stop(); identity = next; entries = {}; expanded = null; }
 });
 $effect(() => { if (expanded && !visible.some(d => d.id === expanded)) { remember(); stop(); expanded = null; } });
 onDestroy(stop);
 async function collapse(focus = true) {
  const id = expanded; remember(); stop(); expanded = null;
  await tick();
  if (focus && id) { buttons.get(id)?.focus({ preventScroll: true }); buttons.get(id)?.scrollIntoView?.({ block: 'nearest' }); }
 }
 function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
   const aborted = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
   const timer = setTimeout(() => { signal.removeEventListener('abort', aborted); resolve(); }, ms);
   signal.addEventListener('abort', aborted, { once: true });
   if (signal.aborted) aborted();
  });
 }
 async function open(id: string, retry = false) {
  if (expanded === id && !retry) { await collapse(); return; }
  remember(); stop(); expanded = id;
  const current = ++generation, packetId = bundle.packetId;
  const entry = entries[id] ?? { loading: false, scroll: 0 }; entries[id] = entry;
  if (entry.result?.status === 'complete') { await tick(); const area = scrollArea(); if (area && expanded === id && generation === current && entry.scroll) area.scrollTop = entry.scroll; return; }
  if (!packetId) return;
  controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(75_000)]);
  entries[id].loading = true; entries[id].result = undefined;
  try {
   for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch('/api/study/lesson', { method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store', signal, body: JSON.stringify({ packetId, discoveryId: id, passage }) });
    const result = await response.json() as LessonResponse;
    if (generation !== current || signal.aborted || bundle.packetId !== packetId) return;
    if (response.status === 202 && result.status === 'pending') {
     await pause(Math.max(2000, Math.min(10_000, Number(response.headers.get('retry-after') || 2) * 1000 || 2000)), signal); continue;
    }
    if (!['complete', 'insufficient', 'unavailable', 'expired'].includes(result.status) || (result.status === 'complete' && (!response.ok || !result.lesson))) throw new Error('Invalid response');
    entries[id].result = result; return;
   }
   throw new Error('Pending too long');
  } catch {
   if (generation === current) entries[id].result = { status: 'unavailable', message: 'This lesson is taking longer than expected. Try again.' };
  } finally { if (generation === current) entries[id].loading = false; }
 }
</script>
<div class="discoveries" bind:this={root}>
 {#each visible as discovery (discovery.id)}
  <article>
   <p class="category">{discovery.category}</p>
   <h3><CitedUnit unit={discovery.title} {sources} /></h3>
   {#each discovery.explanation as unit}<p class="preview"><CitedUnit {unit} {sources} /></p>{/each}
   <p class="preview payoff"><CitedUnit unit={discovery.payoff} {sources} /></p>
   {#if bundle.packetId}
    <button class="expand" type="button" bind:this={() => buttons.get(discovery.id), (el) => { if (el) buttons.set(discovery.id, el); else buttons.delete(discovery.id); }} aria-expanded={expanded === discovery.id} aria-controls={`lesson-${discovery.id}`} onclick={() => open(discovery.id)}>Read the full lesson</button>
   {:else}<p class="status">Full lessons are temporarily unavailable. These discoveries remain readable.</p>{/if}
   {#if expanded === discovery.id}
    <div id={`lesson-${discovery.id}`} class="expanded">
     <div class="lesson-toolbar"><span>{reference}</span><button class="collapse" type="button" onclick={() => collapse()}>Collapse lesson</button></div>
     {#if entries[discovery.id]?.loading}<p role="status" class="status">Researching and checking the full lesson…</p>
     {:else if entries[discovery.id]?.result}
      {@const result = entries[discovery.id].result!}
      {#if result.status === 'complete'}<p class="sr-only" role="status">Lesson ready.</p><DiscoveryLesson lesson={result.lesson} sources={result.sources} />
      {:else}<p role="status" class="status">{result.message}</p>{#if result.status === 'expired'}<button type="button" onclick={onrefresh}>Refresh discoveries</button>{:else if result.status === 'unavailable'}<button type="button" onclick={() => open(discovery.id, true)}>Retry lesson</button>{/if}{/if}
     {/if}
    </div>
   {/if}
  </article>
 {/each}
</div>
<style>
 article { padding:22px 0; border-bottom:1px solid var(--separator); min-width:0; } .category { color:var(--accent); font:600 10px var(--font-ui); text-transform:uppercase; letter-spacing:.08em; margin:0 0 8px; } h3 { margin:0 0 12px; font:600 21px/1.35 var(--font-reading); } .preview { font:16px/1.65 var(--font-reading); margin:0 0 12px; } .payoff { color:var(--ink-2); } button { color:var(--accent); min-height:44px; font:600 12px var(--font-ui); text-decoration:underline; text-underline-offset:3px; cursor:pointer; } button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; } .lesson-toolbar { position:sticky; top:var(--sticky-top,0px); z-index:1; display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--surface); border-block:1px solid var(--separator); font:12px var(--font-ui); margin-top:12px; } .status { color:var(--ink-2); font:12px/1.6 var(--font-ui); } .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); } .discoveries { overflow-wrap:anywhere; }
</style>
