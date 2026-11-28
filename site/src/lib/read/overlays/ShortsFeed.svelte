<script lang="ts">
	import { onMount } from 'svelte';
	import { VIDEO_PLATFORMS, type StudyVideo } from '../study';
	import { Icon } from '../ui';
	import ShortPoster from './ShortPoster.svelte';
	import { embedOf } from './video-embed';

	let { videos, start = 0 }: { videos: StudyVideo[]; start?: number } = $props();
	let feed: HTMLElement;
	let slides: HTMLElement[] = $state([]);
	let active = $state(0);
	/** One clip plays at a time; scrolling it out of view unloads its player. */
	let playing = $state<number | null>(null);

	$effect(() => { if (playing !== null && playing !== active) playing = null; });

	function go(index: number) {
		const target = slides[Math.max(0, Math.min(videos.length - 1, index))];
		if (!target) return;
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		feed.scrollTo({ top: target.offsetTop, behavior: reduce ? 'auto' : 'smooth' });
	}

	function keydown(event: KeyboardEvent) {
		if (event.target !== feed) return;
		const step = event.key === 'ArrowDown' || event.key === 'PageDown' ? 1 : event.key === 'ArrowUp' || event.key === 'PageUp' ? -1 : 0;
		if (!step) return;
		event.preventDefault();
		go(active + step);
	}

	onMount(() => {
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) if (entry.isIntersecting) active = slides.indexOf(entry.target as HTMLElement);
		}, { root: feed, threshold: 0.6 });
		slides.forEach((slide) => observer.observe(slide));
		if (start > 0 && slides[start]) { feed.scrollTop = slides[start].offsetTop; active = start; }
		feed.scrollIntoView({ block: 'start' });
		feed.addEventListener('keydown', keydown);
		return () => { observer.disconnect(); feed.removeEventListener('keydown', keydown); };
	});
</script>

<div class="feed-frame">
	<!-- Focusable scroll region: the arrow keys step one short at a time. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div bind:this={feed} class="feed" tabindex="0" role="region" aria-roledescription="video feed" aria-label="Shorts, {videos.length} videos. Use the arrow keys to move between them.">
		{#each videos as video, i (`${video.platform}:${video.id}`)}
			{@const embed = embedOf(video)}
			{@const name = VIDEO_PLATFORMS[video.platform].name}
			<article bind:this={slides[i]} class="slide" aria-label="{i + 1} of {videos.length}: {video.title}">
				<div class="card">
					{#if playing === i && embed}
						<iframe src={embed} title={video.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
					{:else}
						<button type="button" class="play-area" aria-label="Play {video.title} from {name}" onclick={() => { if (embed) playing = i; else window.open(video.url, '_blank', 'noopener,noreferrer'); }}>
							<ShortPoster {video} />
							<span class="play" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
						</button>
					{/if}
				</div>
				<div class="rail">
					<span class="position" aria-hidden="true">{i + 1}<span class="of">/{videos.length}</span></span>
					<a class="rail-button" href={video.url} target="_blank" rel="noopener noreferrer" aria-label="Open on {name} (opens in a new tab)">
						<Icon name="external" size={20} />
						<span class="rail-label" aria-hidden="true">{name}</span>
					</a>
				</div>
			</article>
		{/each}
	</div>
</div>

<style>
	/* The feed is as tall as the panel allows, but never so tall that a 9:16 card plus the rail overflows its width. */
	.feed-frame { container-type:inline-size; margin-top:14px; }
	/* --sticky-top and --feed-max come from the folio: the feed lands just under the sticky chips and fits the space left. */
	.feed { --rail:52px; position:relative; height:min(640px, var(--feed-max, 72dvh), calc((100cqi - var(--rail) - 8px) * 16 / 9)); scroll-margin-top:calc(var(--sticky-top, 0px) + 14px); overflow-y:auto; scroll-snap-type:y mandatory; scrollbar-width:none; border-radius:16px; outline:none; }
	.feed::-webkit-scrollbar { display:none; }
	.feed:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
	.slide { display:flex; justify-content:center; align-items:stretch; gap:8px; height:100%; scroll-snap-align:start; scroll-snap-stop:always; }
	.card { position:relative; height:100%; aspect-ratio:9 / 16; border-radius:16px; overflow:hidden; background:#000; outline:1px solid oklch(0 0 0 / .1); outline-offset:-1px; }
	:global(html[data-theme='dark']) .card { outline-color:oklch(1 0 0 / .1); }
	iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
	.play-area { position:absolute; inset:0; display:grid; place-items:center; width:100%; padding:0; border-radius:inherit; cursor:pointer; }
	.play { position:relative; z-index:1; display:grid; place-items:center; width:56px; height:56px; padding-left:3px; border-radius:50%; background:rgb(0 0 0 / .55); color:#fff; transition-property:background-color, color; transition-duration:150ms; }
	.play-area:active .play { background:var(--accent); color:var(--on-accent); }
	.rail { display:flex; flex-direction:column; justify-content:space-between; align-items:center; width:var(--rail); padding:4px 0 6px; }
	.position { color:var(--ink); font:600 13px/1 var(--font-ui); font-variant-numeric:tabular-nums; }
	.of { color:var(--ink-2); font-weight:400; }
	.rail-button { display:flex; flex-direction:column; align-items:center; gap:5px; color:var(--ink); text-decoration:none; }
	.rail-button :global(svg) { box-sizing:content-box; padding:12px; border-radius:50%; background:var(--fill); transition-property:background-color; transition-duration:150ms; }
	.rail-button:active :global(svg) { background:var(--separator); }
	.rail-label { color:var(--ink-2); font:11px/1.2 var(--font-ui); text-align:center; }
	@media (hover:hover) and (pointer:fine) {
		.play-area:hover .play { background:var(--accent); color:var(--on-accent); }
		.rail-button:hover :global(svg) { background:var(--separator); }
	}
</style>
