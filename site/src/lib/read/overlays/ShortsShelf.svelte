<script lang="ts">
	import type { StudyVideo } from '../study';
	import ShortPoster from './ShortPoster.svelte';

	let { videos, onopen }: { videos: StudyVideo[]; onopen: (index: number) => void } = $props();
</script>

<section class="shelf" aria-label="Shorts">
	<div class="head">
		<span class="label">Videos<span class="kind">{' · '}Shorts</span></span>
		<button type="button" class="see-all" onclick={() => onopen(0)}>Watch all {videos.length}</button>
	</div>
	<ul>
		{#each videos as video, i (`${video.platform}:${video.id}`)}
			<li><button type="button" class="poster-button" aria-label="Watch {video.title}" onclick={() => onopen(i)}><ShortPoster {video} compact /></button></li>
		{/each}
	</ul>
</section>

<style>
	.shelf { padding:18px 0 4px; border-top:1px solid var(--separator); }
	.head { display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
	.label { color:var(--accent); font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
	.kind { color:var(--ink-2); font-weight:400; letter-spacing:.04em; }
	.see-all { color:var(--accent); font-size:12px; text-decoration:underline; text-underline-offset:2px; }
	ul { display:flex; gap:8px; margin:10px -28px 0; padding:0 28px 6px; list-style:none; overflow-x:auto; scroll-snap-type:x mandatory; scroll-padding-inline:28px; scrollbar-width:none; }
	ul::-webkit-scrollbar { display:none; }
	li { flex:none; scroll-snap-align:start; }
	.poster-button { position:relative; display:block; width:120px; aspect-ratio:9 / 16; padding:0; border-radius:12px; overflow:hidden; outline:1px solid oklch(0 0 0 / .1); outline-offset:-1px; transition-property:scale; transition-duration:150ms; transition-timing-function:cubic-bezier(0.2, 0, 0, 1); }
	:global(html[data-theme='dark']) .poster-button { outline-color:oklch(1 0 0 / .1); }
	.poster-button:active { scale:0.96; }
	.poster-button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
	@media (max-width:600px) { ul { margin-inline:-20px; padding-inline:20px; scroll-padding-inline:20px; } }
	@media (prefers-reduced-motion:reduce) { .poster-button { transition:none; } }
</style>
