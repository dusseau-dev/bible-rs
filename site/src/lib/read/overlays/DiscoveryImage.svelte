<script lang="ts">
 import type { ResearchImage } from '../discoveries';
 import type { StudySource } from '../study';
 import CitedUnit from './CitedUnit.svelte';
 let { image, sources }: { image: ResearchImage; sources: StudySource[] } = $props();
 let failed = $state(false);
</script>
<figure>
 {#if !failed}<img src={image.src} alt={image.alt} loading="lazy" referrerpolicy="no-referrer" onerror={() => failed = true} />
 {:else}<p>Image unavailable. The source record is still available.</p>{/if}
 <figcaption>
  <p><CitedUnit unit={image.caption} {sources} /></p>
  <p>{image.depiction}{image.date ? ` · ${image.date}` : ''}</p>
  {#if image.provenance}<p>{image.provenance}</p>{/if}
  <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">Source record</a> · {image.credit} · <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{image.license}</a>
 </figcaption>
</figure>
<style>
 figure { margin:24px 0; } img { display:block; max-width:100%; height:auto; border-radius:6px; } figcaption { color:var(--ink-2); font:12px/1.6 var(--font-ui); overflow-wrap:anywhere; } p { margin:6px 0; } a { color:var(--accent); text-decoration:underline; }
</style>
