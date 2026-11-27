<script lang="ts">
 import type { EvidenceUnit } from '../discoveries';
 import type { StudySource } from '../study';
 let { unit, sources }: { unit: EvidenceUnit; sources: StudySource[] } = $props();
 const safe = (url: string) => url.startsWith('/read') || /^https:\/\//i.test(url);
</script>
<span>{unit.text}</span>{#each unit.sourceIds as id}{@const index = sources.findIndex(s => s.id === id)}{#if index >= 0 && safe(sources[index].url)}<sup><a href={sources[index].url} target="_blank" rel="noopener noreferrer" aria-label={`Source ${index + 1}: ${sources[index].title}`} title={`${sources[index].title} · ${sources[index].author}`}>[{index + 1}]</a></sup>{/if}{/each}
{#if unit.basis === 'inference' || unit.basis === 'interpretation'}<small>{unit.tradition ? `${unit.tradition} ` : ''}{unit.basis}</small>{/if}
<style>
 a { color:var(--accent); text-decoration:underline; padding:2px; } sup { white-space:nowrap; font:11px var(--font-ui); } small { color:var(--ink-2); font:11px var(--font-ui); margin-left:.4em; } a:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
</style>
