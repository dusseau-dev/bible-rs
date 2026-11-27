<script lang="ts">
	import { onMount } from 'svelte';
	import { getApp } from '../app.svelte';
	import { categories, itemsFrom, type Category } from '../study-items';
	import { discoveryNotices, emptyCategory } from '../discovery-status';
	import type { StudyResult } from '../study';
	import { Icon } from '../ui';

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
							{#if item.title}<h3 class="item-title">{item.title}</h3>{/if}
							<p class="item-text">{item.text}</p>
							{#if item.meta}<p class="meta">{item.meta}</p>{/if}
							{#if item.attribution}<p class="meta">{item.attribution}</p>{/if}
							{#if item.links.length}<div class="links">{#each item.links as link}<a href={link.url} target="_blank" rel="noopener noreferrer">{link.title} <Icon name="external" size={12} /></a>{/each}</div>{/if}
						</li>
					{/each}
				</ol>
			{:else}<p class="loading">{emptyCategory(result, filter)}</p>{/if}
		{/if}
	</div>
</div>

<style>
	.folio { position:fixed; z-index:70; right:16px; top:68px; bottom:16px; width:480px; display:flex; flex-direction:column; background:#fffdf7; color:#263442; border:1px solid #d6d1c4; border-radius:16px; box-shadow:0 15px 40px #0002; outline:none; font:13px/1.5 Arial,sans-serif; }
	.folio :global(::selection) { background:#c7ddd4; color:#203b36; }
	.folio-header { display:flex; align-items:start; justify-content:space-between; gap:16px; padding:23px 28px 19px; border-bottom:1px solid #e4dfd3; }
	.folio-header h2 { margin:0; font:25px/1.2 Georgia,serif; letter-spacing:-.02em; }
	.folio-header p { margin:5px 0 0; color:#596a70; font-size:12px; }
	.icon-button { display:grid; place-items:center; flex:none; width:32px; height:32px; margin:-3px -8px 0 0; border-radius:8px; color:#52616a; }
	.icon-button:active { background:#ebe8df; }
	.content { flex:1; min-height:0; overflow:auto; padding:0 28px 24px; scrollbar-color:#b5beb8 transparent; scrollbar-width:thin; }
	.passage-intro { padding:22px 0 14px; }
	.selection-quote { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; line-clamp:3; margin:0; overflow:hidden; font:16px/1.5 Georgia,serif; }
	.translation { margin:9px 0 0; color:#596a70; font-size:11px; }
	.notice,.alert { margin:16px 0 0; padding:11px 12px; border-radius:8px; background:#f0eee6; }
	.alert { color:#923f35; font-size:12px; }
	.alert button { margin-left:6px; color:inherit; font-weight:700; text-decoration:underline; }
	.loading { margin:13px 0 0; }
	.chips { display:flex; flex-wrap:wrap; gap:6px; position:sticky; top:0; z-index:2; padding:12px 0; background:#fffdf7; border-top:1px solid #dcd8cc; border-bottom:1px solid #e9e5dc; }
	.chips button { display:inline-flex; align-items:center; gap:6px; min-height:30px; padding:5px 11px; border:1px solid #d6d1c4; border-radius:999px; color:#3e4f57; font-size:12px; }
	.chips button:active { background:#f0eee7; }
	.chips button.active { background:#264c46; border-color:#264c46; color:#fffdf7; }
	.chips button.none:not(.active) { color:#8a959a; border-style:dashed; }
	.count { font-size:11px; font-variant-numeric:tabular-nums; opacity:.75; }
	.kind { color:#7a8a86; font-weight:400; letter-spacing:.04em; }
	.items { margin:0; padding:0; list-style:none; }
	.items li { padding:18px 0 19px; border-bottom:1px solid #e9e5dc; }
	.items li:last-child { border-bottom:0; }
	.label { color:#4d7669; font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
	.item-title { margin:7px 0 0; font:600 19px/1.35 var(--font-reading); letter-spacing:-.015em; }
	.item-text { margin:5px 0 0; font:15px/1.55 Georgia,serif; }
	.meta { margin:5px 0 0; color:#596a70; font-size:12px; }
	.links { display:flex; flex-wrap:wrap; gap:5px 12px; margin-top:8px; }
	.links a { display:inline-flex; align-items:center; gap:3px; color:#2d6658; font-size:12px; text-decoration:underline; text-decoration-color:#a9c0b5; text-underline-offset:2px; }
	@media (hover:hover) and (pointer:fine) { .links a:hover { text-decoration-color:currentColor; } .icon-button:hover { background:#ebe8df; } .chips button:hover { background:#f0eee7; } }
	.loading,.notice { color:#596a70; font-size:12px; }
	.folio :global(button:focus-visible),.folio :global(input:focus-visible),.folio :global(a:focus-visible) { outline:2px solid #396e61; outline-offset:2px; }
	@media (max-width:1240px) { .folio { top:auto; left:0; right:0; bottom:0; width:100%; height:min(84dvh,760px); border-radius:16px 16px 0 0; } }
	@media (max-width:600px) { .folio-header { padding:16px 20px 14px; } .folio-header h2 { font-size:22px; } .folio-header p { font-size:11px; } .content { padding:0 20px max(18px,env(safe-area-inset-bottom)); } .passage-intro { padding-top:16px; } .selection-quote { font-size:15px; -webkit-line-clamp:2; line-clamp:2; } }
	.content { overscroll-behavior:contain; }
	@media (pointer:coarse) { .icon-button, .chips button { min-width:44px; min-height:44px; } }
	@media (max-width:1240px) { .folio { left:env(safe-area-inset-left,0px); right:env(safe-area-inset-right,0px); width:auto; } }
</style>
