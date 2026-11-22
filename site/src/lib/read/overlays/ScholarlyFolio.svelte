<script lang="ts">
	import { onMount } from 'svelte';
	import { getApp } from '../app.svelte';
	import type { StudyLayer, StudyResult, StudySource, Tradition } from '../study';
	import { Icon } from '../ui';

	type StudyTab = 'guide' | 'history' | 'academic' | 'testimonials' | 'videos';
	const tabs: { id: StudyTab; label: string }[] = [
		{ id: 'guide', label: 'Guide' },
		{ id: 'history', label: 'History' },
		{ id: 'academic', label: 'Academic' },
		{ id: 'testimonials', label: 'Testimonials' },
		{ id: 'videos', label: 'Videos' }
	];

	const app = getApp();
	const passage = app.studyPassage!;
	const oldTestament = passage.book < 39;
	const traditions: { id: Tradition | 'all'; label: string }[] = [
		{ id: 'all', label: 'All' }, { id: 'protestant', label: 'Protestant' },
		{ id: 'catholic', label: 'Catholic' }, { id: 'orthodox', label: 'Orthodox' },
		...(oldTestament ? [{ id: 'jewish' as const, label: 'Jewish' }] : [])
	];
	const quoteWords = app.wordSpan();
	const selectedQuote = quoteWords ? app.core?.copySpan(quoteWords.translation, quoteWords.span, 'plain') : null;
	let folio: HTMLElement;
	let content: HTMLElement;
	let tab = $state<StudyTab>('guide');
	let result = $state<StudyResult | null>(null);
	let loading = $state(false);
	let error = $state('');
	let tradition = $state<Tradition | 'all'>('all');
	let videoFilter = $state<'all' | 'short' | 'full'>('all');
	let controller: AbortController | null = null;
	const aroundText = $derived(result?.contextText.replace(result.passageText, '').trim() ?? '');
	const close = () => { controller?.abort(); app.studyPassage = null; };
	const visible = (source: StudySource) => tradition === 'all' || source.tradition === tradition;
	const cited = (ids: string[]) => ids.map((id) => result?.sources.find((source) => source.id === id)).filter((s): s is StudySource => Boolean(s));
	const claims = (layer: StudyLayer) => (result?.claims ?? []).filter((claim) => claim.layer === layer && (tab !== 'academic' || tradition === 'all' || claim.tradition === tradition));
	// Earlier-book study notes back the history facts; they are not sources on this passage.
	const sources = (kinds: StudySource['kind'][]) => (result?.sources ?? []).filter((source) => kinds.includes(source.kind) && visible(source) && !(source.kind === 'study_note' && source.scope === 'related'));
	const historicalRecords = () => (result?.sources ?? []).filter((source) => source.kind === 'historical_record');
	const videoTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

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

	function selectTab(next: StudyTab) { tab = next; content?.scrollTo({ top: 0 }); }
	function tabKeydown(event: KeyboardEvent, current: StudyTab) {
		const index = tabs.findIndex((item) => item.id === current);
		const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
			: event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
			: event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
		if (next < 0) return;
		event.preventDefault();
		selectTab(tabs[next].id);
		document.getElementById(`study-tab-${tabs[next].id}`)?.focus();
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
		<div><h2>{result?.reference ?? 'Passage study'}</h2><p>Study the passage and follow the sources</p></div>
		<button type="button" class="icon-button" aria-label="Close study" onclick={close}><Icon name="close" size={18} /></button>
	</header>
	<div bind:this={content} class="content">
		<div class="passage-intro">
			<blockquote class="selection-quote">{selectedQuote ?? result?.passageText ?? 'Reading the selected passage…'}</blockquote>
			<p class="translation">{selectedQuote ? 'Selected text · current translation' : 'World English Bible · public domain'}</p>
		</div>
		{#if error}<p class="alert" role="alert">{error} <button type="button" onclick={() => load()}>Retry</button></p>{/if}
		<div class="tabs" role="tablist" aria-label="Passage study views">
			{#each tabs as item}
				<button type="button" role="tab" id={`study-tab-${item.id}`} aria-controls="study-panel" aria-selected={tab === item.id} tabindex={tab === item.id ? 0 : -1} class:active={tab === item.id} onclick={() => selectTab(item.id)} onkeydown={(event) => tabKeydown(event, item.id)}>{item.label}</button>
			{/each}
		</div>
		{#if loading}<p class="loading" role="status">Reading the sources…</p>{/if}
		{#if result}
			<div id="study-panel" role="tabpanel" aria-labelledby={`study-tab-${tab}`} class="tab-panel">
				{#if tab === 'guide'}
					<section class="guide-intro"><h3>Read the passage closely</h3><p>Move from what the text says to its context, echoes, Christ connection, and response.</p></section>
					{#if result.message}<p class="notice">{result.message}</p>{/if}
					<ol class="guide-list">
						{#each result.guide as step, index}
							<li><span class="step-number">{index + 1}</span><div class="step-body"><h4>{step.id === 'christ' ? 'Connect to Christ' : step.id[0].toUpperCase() + step.id.slice(1)}</h4><p class="step-question">{step.question}</p>{#if step.answer}<p class="step-answer">{step.answer}</p>{#if step.connection}<span class="tag">{step.connection === 'theme' ? 'Thematic reading' : step.connection}</span>{/if}<div class="citations">{#each cited(step.sourceIds) as source}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <Icon name="external" size={12} /></a>{/each}</div>{/if}</div></li>
						{/each}
					</ol>
				{:else if tab === 'history'}
					{#if aroundText}<section><h3>Around this passage</h3><p class="helper">The surrounding paragraph · World English Bible</p><blockquote class="passage">{aroundText}</blockquote></section>{/if}
					<section><h3>Historical setting</h3>{#if claims('history').length}<ul class="facts">{#each claims('history') as claim}<li>{claim.text} <span class="citations">{#each cited(claim.sourceIds) as source}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <Icon name="external" size={12} /></a>{/each}</span></li>{/each}</ul>{/if}{#if !claims('history').length}<p class="empty">No sourced historical setting has been added for this passage.</p>{/if}</section>
					<section><h3>Archaeology &amp; records</h3>{#if historicalRecords().length}<p class="helper">Museum records give context for people and events; they do not verify every detail in the text.</p>{/if}{#each historicalRecords() as source}<article class="source"><strong>{source.title}</strong><span class="tag">{source.location} · Contextual evidence</span><p>{source.excerpt}</p><a href={source.url} target="_blank" rel="noopener noreferrer">{source.author} <Icon name="external" size={12} /></a></article>{/each}{#if !historicalRecords().length}<p class="empty">No curated artifact or historical record is linked to this passage yet.</p>{/if}</section>
				{:else if tab === 'academic'}
					<div class="filter-row"><span>Tradition</span><div class="filters" role="group" aria-label="Interpretive tradition">{#each traditions as item}<button type="button" class:active={tradition === item.id} aria-pressed={tradition === item.id} onclick={() => tradition = item.id}>{item.label}</button>{/each}</div></div>
					<section><h3>Research papers &amp; reports</h3><p class="helper">Open access publication links. Titles suggest relevance; conclusions need review.</p>{#each result.papers ?? [] as paper}<article class="source"><strong>{paper.title}</strong><span class="tag">{paper.type} · {paper.year ?? 'Date unavailable'} · {paper.scope === 'direct' ? 'Selected verse' : 'Chapter context'}</span><p>{paper.authors} · {paper.venue}</p><a href={paper.url} target="_blank" rel="noopener noreferrer">{paper.doi ? `DOI ${paper.doi}` : 'Open publication'} <Icon name="external" size={12} /></a></article>{/each}{#if !(result.papers ?? []).length}<p class="empty">No matching open access paper is available for this passage yet.</p>{/if}</section>
					<section><h3>Scholarship &amp; commentary</h3>{#each sources(['academic', 'commentary', 'study_note']).slice(0, 9) as source}<article class="source"><strong>{source.title}</strong><span class="tag">{source.scope === 'direct' ? 'Direct passage' : 'Related'} · {source.license}</span><p>{source.excerpt}</p><a href={source.url} target="_blank" rel="noopener noreferrer">{source.author} <Icon name="external" size={12} /></a></article>{/each}{#if !sources(['academic', 'commentary', 'study_note']).length}<p class="empty">No attributed sources are available for this passage and tradition.</p>{/if}</section>
					<section><h3>Original language</h3><p class="helper">Glosses are starting points; context determines meaning.</p>{#each result.terms.slice(0, 16) as term}<div class="term"><strong>{term.original}</strong><span>{term.transliteration} · {term.gloss}</span><small>v. {term.verse}</small></div>{/each}{#if !result.terms.length}<p class="empty">No tagged language data is available.</p>{/if}</section>
					<section><h3>Interpretation &amp; uncertainty</h3>{#each [...claims('interpretation'), ...claims('uncertainty')] as claim}<p class="claim">{claim.text} <span class="citations">{#each cited(claim.sourceIds) as source}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <Icon name="external" size={12} /></a>{/each}</span></p>{/each}{#if !claims('interpretation').length && !claims('uncertainty').length}<p class="empty">The available sources do not establish a clear conclusion.</p>{/if}</section>
				{:else if tab === 'testimonials'}
					<section><h3>Other readers’ stories</h3><p class="helper">Personal experience is separate from evidence about the passage. Each story opens on its original forum.</p>{#each result.testimonials as story}<article class="source"><strong>{story.title}</strong><span class="tag">{story.scope === 'direct' ? 'Direct passage' : `Related theme${story.theme ? ` · ${story.theme}` : ''}`}</span><p>{story.author} · Christian Forums at Crosswalk</p><a href={story.url} target="_blank" rel="noopener noreferrer">Read original story <Icon name="external" size={12} /></a></article>{/each}{#if !result.testimonials.length}<p class="empty">No reviewed community stories were found for this passage yet.</p>{/if}</section>
				{:else}
					<section><h3>Videos on YouTube</h3><p class="helper">Short videos are under four minutes. Search results match passage metadata, not reviewed transcripts.</p><div class="filters video-filters" role="group" aria-label="Video length">{#each [{ id: 'all', label: 'All' }, { id: 'short', label: 'Short' }, { id: 'full', label: 'Full' }] as item}<button type="button" class:active={videoFilter === item.id} aria-pressed={videoFilter === item.id} onclick={() => videoFilter = item.id as typeof videoFilter}>{item.label}</button>{/each}</div>{#each result.videos.filter((video) => videoFilter === 'all' || video.format === videoFilter) as video}<article class="source"><strong>{video.title}</strong><span class="tag">{video.scope === 'direct' ? 'Selected passage' : 'Chapter context'} · {video.reviewed ? 'Curated link' : 'YouTube search result'}{video.durationSeconds ? ` · ${videoTime(video.durationSeconds)}` : ''}</span><p>{video.channel}</p><a href={video.url} target="_blank" rel="noopener noreferrer">Watch on YouTube <Icon name="external" size={12} /></a></article>{/each}{#if !result.videos.some((video) => videoFilter === 'all' || video.format === videoFilter)}<p class="empty">No {videoFilter === 'all' ? 'video' : `${videoFilter} video`} is available for this passage yet.</p>{/if}</section>
				{/if}
			</div>
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
	.icon-button:hover { background:#ebe8df; }
	.content { flex:1; min-height:0; overflow:auto; padding:0 28px 24px; scrollbar-color:#b5beb8 transparent; scrollbar-width:thin; }
	.passage-intro { padding:22px 0 14px; }
	.selection-quote { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; line-clamp:3; margin:0; overflow:hidden; font:16px/1.5 Georgia,serif; }
	.translation { margin:9px 0 0; color:#596a70; font-size:11px; }
	.tabs { display:flex; gap:20px; position:sticky; top:0; z-index:2; overflow-x:auto; padding:0; background:#fffdf7; border-bottom:1px solid #dcd8cc; scrollbar-width:none; }
	.tabs::-webkit-scrollbar { display:none; }
	.tabs button { flex:none; min-height:45px; padding:0 1px; border-bottom:2px solid transparent; color:#52616a; font-size:12px; white-space:nowrap; }
	.tabs button:hover { color:#264c46; }
	.tabs button.active { border-bottom-color:#396e61; color:#264c46; font-weight:700; }
	.tab-panel { padding-top:5px; }
	section { padding:23px 0 24px; border-bottom:1px solid #e9e5dc; }
	section:last-child { border-bottom:0; }
	h3 { margin:0 0 10px; font:19px/1.3 Georgia,serif; letter-spacing:-.01em; }
	h4 { margin:0; font:700 13px/1.4 Arial,sans-serif; }
	section p { margin:8px 0; }
	.helper,.empty,.notice,.loading { color:#596a70; font-size:12px; }
	.helper { margin:0 0 14px; line-height:1.55; }
	.empty { padding:12px 0 2px; }
	.notice,.alert { margin:16px 0 0; padding:11px 12px; border-radius:8px; background:#f0eee6; }
	.alert { color:#923f35; font-size:12px; }
	.alert button { margin-left:6px; color:inherit; font-weight:700; text-decoration:underline; }
	.loading { margin:13px 0 0; }
	.guide-intro { padding-bottom:15px; }
	.guide-intro p { color:#596a70; font-size:12px; line-height:1.55; }
	.guide-list { padding:0; margin:0; list-style:none; }
	.guide-list li { display:grid; grid-template-columns:30px minmax(0,1fr); gap:13px; padding:20px 0 22px; border-bottom:1px solid #e9e5dc; }
	.step-number { display:grid; place-items:center; width:27px; height:27px; border-radius:50%; background:#e2ede7; color:#305c50; font-size:12px; font-weight:700; font-variant-numeric:tabular-nums; }
	.step-question { margin:4px 0 0; color:#596a70; font-size:12px; line-height:1.55; }
	.step-answer { margin:10px 0 0; font:15px/1.5 Georgia,serif; }
	.passage { margin:14px 0 0; white-space:pre-line; font:15px/1.6 Georgia,serif; }
	.claim { font:14px/1.55 Georgia,serif; }
	.facts { margin:0; padding:0 0 0 18px; }
	.facts li { padding:7px 0; font:14px/1.55 Georgia,serif; }
	.facts li::marker { color:#4d7669; }
	.facts .citations { margin-top:4px; }
	.source { padding:15px 0; border-bottom:1px solid #e9e5dc; }
	.source:last-child { border-bottom:0; padding-bottom:3px; }
	.source strong { display:block; font:700 14px/1.4 Arial,sans-serif; }
	.source p { margin:7px 0; color:#52616a; font-size:12px; line-height:1.55; }
	.tag { display:block; margin-top:5px; color:#4d7669; font-size:11px; }
	.source a,.citations a { display:inline-flex; align-items:center; gap:3px; color:#2d6658; font-size:12px; text-decoration:underline; text-decoration-color:#a9c0b5; text-underline-offset:2px; }
	.source a:hover,.citations a:hover { text-decoration-color:currentColor; }
	.citations { display:flex; flex-wrap:wrap; gap:5px 12px; margin-top:8px; }
	.term { display:flex; align-items:baseline; gap:9px; padding:8px 0; border-bottom:1px solid #eeeae2; font-size:12px; }
	.term strong { font:17px Georgia,serif; }
	.term span { flex:1; }
	.term small { color:#596a70; }
	.filter-row { padding:16px 0 2px; }
	.filter-row > span { color:#596a70; font-size:11px; font-weight:700; }
	.filters { display:flex; gap:4px; flex-wrap:wrap; margin-top:8px; }
	.filters button { min-height:30px; padding:5px 10px; border-radius:7px; color:#52616a; font-size:11px; }
	.filters button:hover { background:#f0eee7; }
	.filters button.active { background:#dcebe4; color:#264c46; font-weight:700; }
	.video-filters { margin:13px 0 4px; }
	.folio :global(button:focus-visible),.folio :global(input:focus-visible),.folio :global(a:focus-visible) { outline:2px solid #396e61; outline-offset:2px; }
	@media (max-width:1240px) { .folio { top:auto; left:0; right:0; bottom:0; width:100%; height:min(84dvh,760px); border-radius:16px 16px 0 0; } }
	@media (max-width:600px) { .folio-header { padding:16px 20px 14px; } .folio-header h2 { font-size:22px; } .folio-header p { font-size:11px; } .content { padding:0 20px max(18px,env(safe-area-inset-bottom)); } .passage-intro { padding-top:16px; } .selection-quote { font-size:15px; -webkit-line-clamp:2; line-clamp:2; } .tabs { gap:17px; } }
</style>
