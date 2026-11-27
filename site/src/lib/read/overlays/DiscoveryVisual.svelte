<script lang="ts">
 import type { LessonVisual } from '../discoveries';
 import type { StudySource } from '../study';
 import { layoutVisual } from './discovery-visual';
 import CitedUnit from './CitedUnit.svelte';
 let { visual, sources }: { visual: LessonVisual; sources: StudySource[] } = $props();
 const layout = $derived(layoutVisual(visual));
 const title = $derived(({ relationships: 'Relationships in this passage', structure: 'The passage’s literary structure', timeline: 'Dates in the evidence', geography: 'Locations in the evidence', quantitative: 'Measurements in the evidence' })[visual.kind]);
 const point = (id: string) => layout?.points.find(p => p.id === id);
</script>
<figure>
 <h4>{title}</h4>
 {#if layout}
 <svg viewBox="0 0 420 300" role="img" aria-label={title}>
  <title>{title}</title><desc>{visual.explanation.text} Numbered points and connections are described in the list below. {visual.limitations}</desc>
  {#if layout.numeric}
   <line class="axis" x1="50" y1="250" x2="370" y2="250" />
   <text x="65" y="267">{layout.xmin}</text><text x="355" y="267">{layout.xmax}</text>
   <text x="210" y="289">{visual.xLabel ?? (visual.kind === 'timeline' ? 'Year (negative = BCE)' : 'Longitude')} {visual.xUnit ?? (visual.kind === 'geography' ? 'degrees' : '')}</text>
  {/if}
  {#if layout.twoAxes}
   <line class="axis" x1="50" y1="250" x2="50" y2="25" />
   <text x="29" y="230">{layout.ymin}</text><text x="29" y="40">{layout.ymax}</text>
   <text x="210" y="17">{visual.yLabel ?? 'Latitude'} {visual.yUnit ?? (visual.kind === 'geography' ? 'degrees' : '')}</text>
  {/if}
  {#each visual.edges as edge, i}{@const a = point(edge.from)}{@const b = point(edge.to)}
   {#if a && b}<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} /><text class="edge" x={(a.x + b.x) / 2 + 8} y={(a.y + b.y) / 2 - 8}>E{i + 1}</text>{/if}
  {/each}
  {#each layout.points as p}
   {#if p.xLow !== null || p.xHigh !== null}<line class="interval" x1={p.xLow ?? p.x} y1={p.y} x2={p.xHigh ?? p.x} y2={p.y} />{/if}
   {#if p.yLow !== null || p.yHigh !== null}<line class="interval" x1={p.x} y1={p.yLow ?? p.y} x2={p.x} y2={p.yHigh ?? p.y} />{/if}
   <circle cx={p.x} cy={p.y} r="12" /><text class="point" x={p.x} y={p.y + 4}>{p.number}</text>
  {/each}
 </svg>
 <ol>{#each visual.nodes as node}<li><CitedUnit unit={node.label} {sources} />{#if layout.numeric}<span class="values"> · {node.x} {visual.xUnit ?? ''}{#if node.xLow !== null || node.xHigh !== null} [{node.xLow ?? node.x}–{node.xHigh ?? node.x}]{/if}{#if layout.twoAxes} / {node.y} {visual.yUnit ?? ''}{#if node.yLow !== null || node.yHigh !== null} [{node.yLow ?? node.y}–{node.yHigh ?? node.y}]{/if}{/if}</span>{/if}</li>{/each}</ol>
 {#if visual.edges.length}<ul>{#each visual.edges as edge, i}<li>E{i + 1}: {point(edge.from)?.number} → {point(edge.to)?.number} · <CitedUnit unit={edge.label} {sources} /></li>{/each}</ul>{/if}
 {:else}<p>The diagram’s data is unavailable.</p>{/if}
 <figcaption><p><CitedUnit unit={visual.explanation} {sources} /></p><p>{visual.limitations}</p>{#if visual.kind === 'geography'}<p>This coordinate plot does not show terrain or travel distance.</p>{/if}</figcaption>
</figure>
<style>
 figure { margin:24px 0; padding:16px 0; border-block:1px solid var(--separator); } h4 { font:600 17px var(--font-reading); margin:0 0 12px; } svg { display:block; width:100%; height:auto; overflow:visible; } line { stroke:var(--ink-2); stroke-width:1.5; } line.interval { stroke:var(--accent); stroke-width:4; } circle { fill:var(--accent); } text { fill:var(--ink); font:11px var(--font-ui); text-anchor:middle; } text.point { fill:var(--on-accent); font-weight:700; } .axis { stroke:var(--border); } ol,ul { padding-left:20px; } li,figcaption { font:12px/1.6 var(--font-ui); overflow-wrap:anywhere; } li { margin-bottom:8px; } figcaption { color:var(--ink-2); } .values { font-variant-numeric:tabular-nums; }
</style>
