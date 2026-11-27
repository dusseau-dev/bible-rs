<script lang="ts">
 import type { Lesson } from '../discoveries';
 import type { StudySource } from '../study';
 import { BOOKS, bookSlug } from '../books';
 import CitedUnit from './CitedUnit.svelte';
 import DiscoveryVisual from './DiscoveryVisual.svelte';
 import DiscoveryImage from './DiscoveryImage.svelte';
 let { lesson, sources }: { lesson: Lesson; sources: StudySource[] } = $props();
 const headings = { discovery: 'The discovery', passage: 'The passage', evidence: 'The evidence', disagreement: 'The disagreement', payoff: 'The payoff' };
</script>
<div class="lesson">
 {#each lesson.sections as section}
  <section><h3>{headings[section.kind]}</h3>{#each section.units as unit}<p><CitedUnit {unit} {sources} /></p>{/each}</section>
  {#if section.kind === 'evidence'}<DiscoveryVisual visual={lesson.visual} {sources} />{#each lesson.images as image}{#key image.id}<DiscoveryImage {image} {sources} />{/key}{/each}{/if}
 {/each}
 <section><h3>Try the reading yourself</h3>
  <ul>{#each lesson.exercise.passages as p}<li><a href={`/read/web/${bookSlug(BOOKS[p.book])}/${p.chapter}#v${p.firstVerse}`} target="_blank" rel="noopener noreferrer">{BOOKS[p.book].name} {p.chapter}:{p.firstVerse}{p.lastVerse > p.firstVerse ? `–${p.lastVerse}` : ''}</a></li>{/each}</ul>
  <ol>{#each lesson.exercise.questions as question}<li>{question}</li>{/each}</ol>
 </section>
 <details><summary>Sources and credits ({sources.length})</summary><ol>{#each sources as source}<li><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> · {source.author} · {source.location} · {source.license}</li>{/each}</ol></details>
</div>
<style>
 .lesson { min-width:0; overflow-wrap:anywhere; } section { margin-top:24px; } h3 { margin:0 0 10px; font:600 21px/1.3 var(--font-reading); } p,li { font:16px/1.7 var(--font-reading); } p { margin:0 0 14px; } a { color:var(--accent); text-decoration:underline; } ul,ol { padding-left:22px; } li { margin-bottom:10px; } details { margin-top:24px; border-top:1px solid var(--separator); color:var(--ink-2); } summary { min-height:44px; padding:12px 0; cursor:pointer; } details li { font:12px/1.6 var(--font-ui); } a:focus-visible,summary:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
</style>
