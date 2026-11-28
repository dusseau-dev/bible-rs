<script lang="ts">
	import { VIDEO_PLATFORMS, type StudyVideo } from '../study';
	import { videoTime } from '../study-items';
	import { posterOf } from './video-embed';

	let { video, compact = false }: { video: StudyVideo; compact?: boolean } = $props();
	let failed = $state(false);
	const src = $derived(posterOf(video));
	const meta = $derived([video.channel, video.durationSeconds ? videoTime(video.durationSeconds) : ''].filter(Boolean).join(' · '));
</script>

<span class="poster {video.platform}" class:compact>
	{#if src && !failed}
		<img {src} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"
			onerror={() => failed = true} onload={(event) => { if ((event.currentTarget as HTMLImageElement).naturalWidth <= 120) failed = true; }} />
	{/if}
	<span class="badge">{VIDEO_PLATFORMS[video.platform].label}</span>
	<span class="caption">
		<span class="title">{video.title}</span>
		{#if !compact && meta}<span class="meta">{meta}</span>{/if}
	</span>
</span>

<style>
	/* Platform-tinted fallbacks show when a poster is missing (Instagram) or fails to load. */
	.poster { position:absolute; inset:0; display:block; overflow:hidden; border-radius:inherit; background:#111; color:#fff; text-align:start; }
	.poster.tiktok { background:linear-gradient(160deg, #0f2a2e, #111 45%, #2e0f1a); }
	.poster.instagram { background:linear-gradient(160deg, #4f2c8f, #b5306b 55%, #e6893a); }
	.poster.youtube { background:linear-gradient(160deg, #2a2a2a, #0d0d0d); }
	img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
	.poster::after { content:''; position:absolute; inset:45% 0 0; background:linear-gradient(transparent, rgb(0 0 0 / .78)); pointer-events:none; }
	.badge { position:absolute; z-index:1; top:10px; left:10px; padding:3px 8px; border-radius:999px; background:rgb(0 0 0 / .55); font:600 11px/16px var(--font-ui); letter-spacing:.01em; }
	.caption { position:absolute; z-index:1; left:14px; right:14px; bottom:14px; display:grid; gap:4px; }
	.title { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; line-clamp:2; overflow:hidden; font:600 15px/1.3 var(--font-ui); text-shadow:0 1px 2px rgb(0 0 0 / .4); }
	.meta { color:rgb(255 255 255 / .8); font:12px/16px var(--font-ui); }
	.compact .badge { top:6px; left:6px; padding:2px 6px; font-size:10px; line-height:14px; }
	.compact .caption { left:8px; right:8px; bottom:8px; }
	.compact .title { -webkit-line-clamp:3; line-clamp:3; font-size:12px; line-height:1.3; }
</style>
