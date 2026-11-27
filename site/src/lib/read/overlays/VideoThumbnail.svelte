<script lang="ts">
	import type { StudyVideo } from '../study';
	let { video }: { video: StudyVideo } = $props();
	let failed = $state(false);
	const src = $derived(/^[A-Za-z0-9_-]{11}$/.test(video.id) ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : null);
</script>

<a class="video-thumbnail" href={video.url} target="_blank" rel="noopener noreferrer" aria-label="Watch {video.title} on YouTube (opens in a new tab)">
	{#if src && !failed}
		<img {src} alt="" width="480" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer"
			onerror={() => failed = true} onload={(event) => { if ((event.currentTarget as HTMLImageElement).naturalWidth <= 120) failed = true; }} />
	{/if}
	<span class="play" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
	{#if !src || failed}<span class="unavailable">Preview unavailable</span>{/if}
</a>

<style>
	.video-thumbnail { position:relative; display:grid; place-items:center; width:100%; aspect-ratio:16/9; margin:10px 0; overflow:hidden; border:1px solid var(--border); border-radius:10px; background:var(--fill); text-decoration:none; }
	img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
	.play { position:relative; display:grid; place-items:center; width:48px; height:48px; border-radius:50%; background:rgb(0 0 0 / .7); color:#fff; }
	.unavailable { position:absolute; bottom:12px; color:var(--ink-2); font:12px/18px var(--font-ui); }
	.video-thumbnail:active .play { background:var(--accent); color:var(--on-accent); }
	@media (hover:hover) and (pointer:fine) { .video-thumbnail:hover .play { background:var(--accent); color:var(--on-accent); } }
</style>
