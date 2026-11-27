<script lang="ts">
	import { onMount } from 'svelte';
	import { getApp } from '../app.svelte';
	import { categories, itemsFrom, type Category } from '../study-items';
	import { discoveryNotices, emptyCategory } from '../discovery-status';
	import type { StudyResult } from '../study';
	import { Icon } from '../ui';
	import VideoThumbnail from './VideoThumbnail.svelte';

	const app = getApp();
	const passage = app.studyPassage!;
	const quoteWords = app.wordSpan();
	const selectedQuote = quoteWords ? app.core?.copySpan(quoteWords.translation, quoteWords.span, 'plain') : null;
	let folio: HTMLElement;
	let result = $state<StudyResult | null>(null);
	let loading = $state(false);
	let error = $state('');
	let filter = $state<Category | 'all'>(app.studyCategory);
	let controller: AbortController | null = null;
	const close = () => { controller?.abort(); app.studyPassage = null; };

	const items = $derived(result ? itemsFrom(result) : []);
	const shown = $derived(filter === 'all' ? items : items.filter((item) => item.category === filter));
	const credits = $derived([...new Set(items.flatMap(item => item.attribution?.split('; ') ?? []))]);
	const count = (c: Category) => items.filter((item) => item.category === c).length;
	const labelOf = (c: Category) => categories.find((x) => x.id === c)!.label;

	async function load() {
		controller?.abort();
		const current = new AbortController();
		controller = current;
		loading = true; error = '';
		try {
			const response = await fetch('/api/study', {
				method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store', signal: current.signal,
				body: JSON.stringify({ passage, mode: 'open', style: 'standard' })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || 'The study could not load');
			if (controller !== current) return;
			result = data as StudyResult;
		} catch (cause) {
			if (!current.signal.aborted) error = cause instanceof Error ? cause.message : 'The study could not load';
		} finally { if (controller === current) loading = false; }
	}

	function keydown(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); close(); } }
	onMount(() => {
		const before = document.activeElement as HTMLElement | null;
		folio?.focus({ preventScroll: true });
		void load();
		return () => { controller?.abort(); if (before?.isConnected) before.focus({ preventScroll: true }); };
	});
</script>

<div bind:this={folio} class="folio" role="dialog" aria-modal="false" aria-label="Go deeper passage study" tabindex="-1" onkeydown={keydown}>
	<header class="folio-header">
		<div><h2>{result?.reference ?? 'Passage study'}</h2><p>A closer look at the words, the evidence, and what they change</p></div>
		<button type="button" class="icon-button" aria-label="Close study" onclick={close}><Icon name="close" size={18} /></button>
	</header>
	<div class="content">
		<div class="passage-intro">
			<blockquote class="selection-quote">{selectedQuote ?? result?.passageText ?? 'Reading the selected passage…'}</blockquote>
			<p class="translation">{selectedQuote ? 'Selected text · current translation' : 'World English Bible · public domain'}</p>
		</div>
		<div class="chips" role="group" aria-label="Show category">
			<button type="button" class:active={filter === 'all'} aria-pressed={filter === 'all'} onclick={() => filter = 'all'}>All{#if result}<span class="count">{items.length}</span>{/if}</button>
			{#each categories as c}<button type="button" class:active={filter === c.id} class:none={result && !count(c.id)} aria-pressed={filter === c.id} onclick={() => filter = c.id}>{c.label}{#if result}<span class="count">{count(c.id)}</span>{/if}</button>{/each}
		</div>
		{#if error}<p class="alert" role="alert">{error} <button type="button" onclick={() => load()}>Retry</button></p>{/if}
		{#if loading}<p class="loading" role="status">Reading the sources…</p>{/if}
		{#if result}
			{#each discoveryNotices(result, filter) as notice}<p class="notice" role="status">{notice}</p>{/each}
			{#if result.message}<p class="notice">{result.message}</p>{/if}
			{#if shown.length}
				<ol class="items">
					{#each shown as item}
						<li>
							<span class="label">{labelOf(item.category)}<span class="kind">{' · '}{item.kind}</span></span>
							{#if item.video}{#key item.video.id}<VideoThumbnail video={item.video} />{/key}{/if}
							{#if item.title}<h3 class="item-title">{item.title}</h3>{/if}
							<p class="item-text">{item.text}</p>
							{#if item.meta}<p class="meta">{item.meta}</p>{/if}
							{#if item.links.length}<div class="links">{#each item.links as link}<a href={link.url} target="_blank" rel="noopener noreferrer">{link.title} <Icon name="external" size={12} /></a>{/each}</div>{/if}
						</li>
					{/each}
				</ol>
			{:else}<p class="loading">{emptyCategory(result, filter)}</p>{/if}
			{#if credits.length}
				<details class="credits">
					<summary onkeydown={(event) => { if (event.key === ' ') event.stopPropagation(); }}>Source credits</summary>
					<ul>{#each credits as credit}<li>{credit}</li>{/each}</ul>
				</details>
			{/if}
		{/if}
	</div>
</div>

<style>
	.folio { position:fixed; z-index:70; right:16px; top:68px; bottom:16px; width:480px; display:flex; flex-direction:column; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:16px; box-shadow:var(--shadow-modal); outline:none; font:13px/1.5 var(--font-ui); }
	.folio :global(::selection) { background:var(--selection); color:var(--ink); }
	.folio-header { display:flex; align-items:start; justify-content:space-between; gap:16px; padding:23px 28px 19px; border-bottom:1px solid var(--separator); }
	.folio-header h2 { margin:0; font:25px/1.2 var(--font-reading); letter-spacing:-.02em; }
	.folio-header p { margin:5px 0 0; color:var(--ink-2); font-size:12px; }
	.icon-button { display:grid; place-items:center; flex:none; width:32px; height:32px; margin:-3px -8px 0 0; border-radius:8px; color:var(--ink-2); }
	.icon-button:active { background:var(--fill); }
	.content { flex:1; min-height:0; overflow:auto; padding:0 28px 24px; scrollbar-color:var(--ink-2) transparent; scrollbar-width:thin; }
	.passage-intro { padding:22px 0 14px; }
	.selection-quote { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; line-clamp:3; margin:0; overflow:hidden; font:16px/1.5 var(--font-reading); }
	.translation { margin:9px 0 0; color:var(--ink-2); font-size:11px; }
	.notice,.alert { margin:16px 0 0; padding:11px 12px; border-radius:8px; background:var(--fill); }
	.alert { color:var(--danger); font-size:12px; }
	.alert button { margin-left:6px; color:inherit; font-weight:700; text-decoration:underline; }
	.loading { margin:13px 0 0; }
	.chips { display:flex; flex-wrap:wrap; gap:6px; position:sticky; top:0; z-index:2; padding:12px 0; background:var(--surface); border-top:1px solid var(--separator); border-bottom:1px solid var(--separator); }
	.chips button { display:inline-flex; align-items:center; gap:6px; min-height:30px; padding:5px 11px; border:1px solid var(--border); border-radius:999px; color:var(--ink-2); font-size:12px; }
	.chips button:active:not(.active) { background:var(--fill); }
	.chips button.active { background:var(--accent); border-color:var(--accent); color:var(--on-accent); }
	.chips button.none:not(.active) { color:var(--ink-2); border-style:dashed; }
	.count { font-size:11px; font-variant-numeric:tabular-nums; opacity:.75; }
	.kind { color:var(--ink-2); font-weight:400; letter-spacing:.04em; }
	.items { margin:0; padding:0; list-style:none; }
	.items li { padding:18px 0 19px; border-bottom:1px solid var(--separator); }
	.items li:last-child { border-bottom:0; }
	.label { color:var(--accent); font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
	.item-title { margin:7px 0 0; font:600 19px/1.35 var(--font-reading); letter-spacing:-.015em; }
	.item-text { margin:5px 0 0; font:15px/1.55 var(--font-reading); }
	.meta { margin:5px 0 0; color:var(--ink-2); font-size:12px; }
	.credits { margin-top:16px; border-top:1px solid var(--separator); color:var(--ink-2); font-size:12px; }
	.credits summary { min-height:44px; padding:12px 0; cursor:pointer; }
	.credits summary:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
	.credits ul { margin:0; padding:0 0 0 18px; }
	.credits li { margin:0 0 8px; overflow-wrap:anywhere; }
	.links { display:flex; flex-wrap:wrap; gap:5px 12px; margin-top:8px; }
	.links a { display:inline-flex; align-items:center; gap:3px; color:var(--accent); font-size:12px; text-decoration:underline; text-decoration-color:currentColor; text-underline-offset:2px; }
	@media (hover:hover) and (pointer:fine) { .links a:hover { text-decoration-color:currentColor; } .icon-button:hover { background:var(--fill); } .chips button:hover:not(.active) { background:var(--fill); } }
	.loading,.notice { color:var(--ink-2); font-size:12px; }
	.folio :global(button:focus-visible),.folio :global(input:focus-visible),.folio :global(a:focus-visible) { outline:2px solid var(--accent); outline-offset:2px; }
	@media (max-width:1240px) { .folio { top:auto; left:0; right:0; bottom:0; width:100%; height:min(84dvh,760px); border-radius:16px 16px 0 0; } }
	@media (max-width:600px) { .folio-header { padding:16px 20px 14px; } .folio-header h2 { font-size:22px; } .folio-header p { font-size:11px; } .content { padding:0 20px max(18px,env(safe-area-inset-bottom)); } .passage-intro { padding-top:16px; } .selection-quote { font-size:15px; -webkit-line-clamp:2; line-clamp:2; } }
	.content { overscroll-behavior:contain; }
	@media (pointer:coarse) { .icon-button, .chips button { min-width:44px; min-height:44px; } }
	@media (max-width:1240px) { .folio { left:env(safe-area-inset-left,0px); right:env(safe-area-inset-right,0px); width:auto; } }
</style>
