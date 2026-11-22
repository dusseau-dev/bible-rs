<script lang="ts">
	import { onMount } from 'svelte';
	import { getApp } from '../app.svelte';
	import type { StudyLayer, StudyResult, StudySource, Tradition } from '../study';
	import { getStudyKey, setStudyKey } from './study-key';

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
	let tab = $state<'history' | 'academic' | 'testimonials' | 'videos'>('history');
	let result = $state<StudyResult | null>(null);
	let loading = $state(false);
	let error = $state('');
	let apiKey = $state(getStudyKey());
	let style = $state<'standard' | 'simple'>('standard');
	let tradition = $state<Tradition | 'all'>('all');
	let question = $state('');
	let asked = $state('');
	let controller: AbortController | null = null;
	const close = () => { controller?.abort(); app.studyPassage = null; };
	const visible = (source: StudySource) => tradition === 'all' || source.tradition === tradition;
	const cited = (ids: string[]) => ids.map((id) => result?.sources.find((source) => source.id === id)).filter((s): s is StudySource => Boolean(s));
	const claims = (layer: StudyLayer) => (result?.claims ?? []).filter((claim) => claim.layer === layer && (tradition === 'all' || claim.tradition === tradition));
	const sources = (kinds: StudySource['kind'][]) => (result?.sources ?? []).filter((source) => kinds.includes(source.kind) && visible(source));

	async function load(mode: 'open' | 'ask' = 'open') {
		controller?.abort();
		const current = new AbortController(); controller = current;
		loading = true; error = '';
		if (mode === 'ask') asked = question.trim();
		try {
			const response = await fetch('/api/study', {
				method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store', signal: current.signal,
				body: JSON.stringify({ passage, mode, question: mode === 'ask' ? asked : undefined, style, openaiKey: apiKey.trim() || undefined })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || 'The study could not load');
			if (controller !== current) return;
			result = data as StudyResult;
			setStudyKey(apiKey);
		} catch (cause) {
			if (!current.signal.aborted) error = cause instanceof Error ? cause.message : 'The study could not load';
		} finally { if (controller === current) loading = false; }
	}

	function selectTab(next: typeof tab) { tab = next; content?.scrollTo({ top: 0 }); }
	function keydown(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
	onMount(() => {
		const before = document.activeElement as HTMLElement | null;
		folio?.focus({ preventScroll: true });
		void load();
		return () => { controller?.abort(); if (before?.isConnected) before.focus({ preventScroll: true }); };
	});
</script>

<div bind:this={folio} class="folio" role="dialog" aria-modal="false" aria-label="Go deeper passage study" tabindex="-1" onkeydown={keydown}>
	<header><div><span class="eyebrow">PASSAGE STUDY</span><h2>{result?.reference ?? 'Go deeper'}</h2></div><button type="button" aria-label="Close study" onclick={close}>×</button></header>
	<div bind:this={content} class="content">
		<blockquote class="selection-quote">{selectedQuote ?? result?.passageText ?? 'Reading the selected passage…'}</blockquote>
		<p class="translation">{selectedQuote ? 'Selected text · current translation' : 'World English Bible · public domain'}</p>
		{#if error}<p class="alert" role="alert">{error} <button type="button" onclick={() => load()}>Retry</button></p>{/if}
		{#if result?.message}<p class="notice">{result.message}</p>{/if}
		{#if loading}<p class="notice">Reading the sources…</p>{/if}
		<details class="path"><summary>Reading path <span>Observe → Contextualize → Trace → Christ → Apply</span></summary>
			{#each result?.guide ?? [] as step}<div class="path-step"><strong>{step.id === 'christ' ? 'Connect to Christ' : step.id[0].toUpperCase() + step.id.slice(1)}</strong><p>{step.question}</p>{#if step.answer}<p class="step-answer">{step.answer} {#if step.connection}<em>({step.connection === 'theme' ? 'thematic reading' : step.connection})</em>{/if}</p><div class="citations">{#each cited(step.sourceIds) as source}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>{/each}</div>{/if}</div>{/each}
		</details>
		<div class="tabs" role="tablist" aria-label="Study evidence">
			{#each [{ id: 'history', label: 'History' }, { id: 'academic', label: 'Academic' }, { id: 'testimonials', label: 'Testimonials' }, { id: 'videos', label: 'Videos' }] as item}<button type="button" role="tab" class:active={tab === item.id} aria-selected={tab === item.id} onclick={() => selectTab(item.id as typeof tab)}>{item.label}</button>{/each}
		</div>
		{#if result}
			{#if tab === 'history'}
				<section><h3>The text in context</h3><p class="translation">World English Bible · public domain</p><blockquote class="passage">{result.passageText}</blockquote><details><summary>Read the surrounding paragraph</summary><blockquote class="passage">{result.contextText}</blockquote></details></section>
				<section><h3>Historical setting</h3><p class="helper">Only source-supported setting and first-reader claims appear here.</p>{#each claims('history') as claim}<p>{claim.text} <span class="citations">{#each cited(claim.sourceIds) as source}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>{/each}</span></p>{/each}{#if !claims('history').length}<p class="empty">No sourced historical reconstruction is available for this passage yet.</p>{/if}</section>
			{:else if tab === 'academic'}
				<div class="traditions" aria-label="Interpretive tradition">{#each traditions as item}<button type="button" class:active={tradition === item.id} onclick={() => tradition = item.id}>{item.label}</button>{/each}</div>
				<section><h3>Scholarship and sources</h3>{#each sources(['academic','commentary','study_note']).slice(0,9) as source}<article class="source"><strong>{source.title}</strong><span class="tag">{source.scope === 'direct' ? 'Direct passage' : 'Related'} · {source.license}</span><p>{source.excerpt}</p><a href={source.url} target="_blank" rel="noopener noreferrer">{source.author} ↗</a></article>{/each}{#if !sources(['academic','commentary','study_note']).length}<p class="empty">No attributed sources are available for this passage and tradition.</p>{/if}</section>
				<section><h3>Original-language notes</h3><p class="helper">Glosses are starting points; context determines meaning. STEPBible data is CC BY 4.0.</p>{#each result.terms.slice(0,16) as term}<div class="term"><strong>{term.original}</strong> {term.transliteration} · {term.gloss} <small>v. {term.verse}</small></div>{/each}{#if !result.terms.length}<p class="empty">No tagged language data is available.</p>{/if}</section>
				<section><h3>Interpretation and uncertainty</h3>{#each [...claims('interpretation'), ...claims('uncertainty')] as claim}<p>{claim.text} <span class="citations">{#each cited(claim.sourceIds) as source}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>{/each}</span></p>{/each}{#if !claims('interpretation').length && !claims('uncertainty').length}<p class="empty">The available sources do not establish a clear conclusion.</p>{/if}</section>
			{:else if tab === 'testimonials'}
				<section><h3>Other readers' stories</h3><p class="helper">Personal experience is separate from evidence about this passage's meaning. Read each story on its original forum.</p>{#each result.testimonials as story}<article class="source"><strong>{story.title}</strong><span class="tag">{story.scope === 'direct' ? 'Direct passage' : `Related theme${story.theme ? ` · ${story.theme}` : ''}`}</span><p>{story.author} · Christian Forums at Crosswalk</p><a href={story.url} target="_blank" rel="noopener noreferrer">Read original story ↗</a></article>{/each}{#if !result.testimonials.length}<p class="empty">No reviewed community stories were found for this passage yet.</p>{/if}</section>
			{:else}
				<section><h3>Sermons and lectures</h3><p class="helper">Video links are reviewed; spoken content has not been verified.</p>{#each result.videos as video}<article class="source"><strong>{video.title}</strong><span class="tag">{video.scope === 'direct' ? 'Direct passage' : 'Related topic'}</span><p>{video.channel}</p><a href={video.url} target="_blank" rel="noopener noreferrer">Watch video ↗</a></article>{/each}{#if !result.videos.length}<p class="empty">No reviewed video is available for this passage yet.</p>{/if}</section>
			{/if}
		{/if}
	</div>
	<div class="bottom"><details><summary>OpenAI key and explanation style</summary><label>Your OpenAI API key <small>Kept in tab memory; sent through this site's server for each request.</small><input type="password" autocomplete="off" bind:value={apiKey} oninput={(event) => setStudyKey(event.currentTarget.value)} placeholder="Optional for summaries and Ask" /></label><label>Explanation <select bind:value={style}><option value="standard">Standard</option><option value="simple">Simple</option></select></label><button type="button" onclick={() => load()} disabled={loading}>Update study</button></details><form onsubmit={(e) => { e.preventDefault(); if (question.trim() && !loading) void load('ask'); }}><input aria-label="Ask a follow-up" maxlength="500" bind:value={question} placeholder="Ask a follow-up" /><button type="submit" disabled={loading || !question.trim()}>↑</button></form>{#if asked && result?.answer}<div class="follow-answer"><strong>{asked}</strong><p>{result.answer.text}</p><div class="citations">{#each cited(result.answer.sourceIds) as source}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>{/each}</div></div>{/if}</div>
</div>

<style>
	.folio{position:fixed;z-index:70;right:16px;top:68px;bottom:16px;width:390px;display:flex;flex-direction:column;background:#fffdf7;color:#263442;border:1px solid #d6d1c4;border-radius:17px;box-shadow:0 15px 40px #0002;outline:none;font:13px/1.5 Arial,sans-serif}
	header{display:flex;align-items:start;justify-content:space-between;gap:15px;padding:21px 24px 16px;border-bottom:1px solid #ddd8cd}header h2{font:22px Georgia,serif;margin:3px 0 0}.eyebrow{font-size:10px;font-weight:700;letter-spacing:.13em;color:#55796e}header button{font-size:25px;color:#6b777c;line-height:1}
	.content{overflow:auto;padding:0 24px;flex:1}.selection-quote{margin:18px 0 4px;padding-left:13px;border-left:2px solid #68988e;font:15px/1.5 Georgia,serif;max-height:75px;overflow:hidden}.translation,.helper,.empty{color:#596a70;font-size:12px}.translation{margin:3px 0 15px}.notice,.alert{padding:10px;border-radius:8px;background:#f1eee5;color:#596a70;font-size:12px}.alert{color:#9d3e35}
	.path{border-top:1px solid #ddd8cd;border-bottom:1px solid #ddd8cd;padding:12px 0}.path summary{cursor:pointer;font-weight:700;color:#365e56}.path summary span{display:block;font-size:11px;color:#62736e;font-weight:400}.path-step{padding:10px 0;border-top:1px solid #ece7dc}.path-step:first-of-type{margin-top:12px}.path-step strong{font-size:12px;color:#365e56}.path-step p{margin:3px 0;font-size:12px}.path-step .step-answer{font-size:13px}.path-step em{color:#66766f}
	.tabs{display:flex;gap:3px;overflow:auto;position:sticky;top:0;background:#fffdf7;z-index:1;padding:13px 0 8px;border-bottom:1px solid #ddd8cd}.tabs button,.traditions button{padding:8px 9px;border-radius:8px;color:#52616a;font-size:12px;white-space:nowrap}.tabs .active,.traditions .active{background:#dcebe6;color:#264c46;font-weight:700}.traditions{display:flex;overflow:auto;gap:2px;margin-top:12px}
	section{padding:18px 0;border-bottom:1px solid #e6e0d6}h3{font:17px Georgia,serif;margin:0 0 10px}section p{margin:9px 0}.passage{margin:10px 0;padding-left:12px;border-left:2px solid #c4d4cc;white-space:pre-line;font:14px/1.6 Georgia,serif}.source{border:1px solid #ddd8cd;border-radius:9px;padding:10px 12px;margin:9px 0}.source strong{display:block;font-size:13px}.source p{font-size:12px;color:#596a70}.source a,.citations a{color:#365e56;text-decoration:none;font-size:11px}.source a:hover,.citations a:hover{text-decoration:underline}.tag{display:inline-block;font-size:10px;color:#365e56;margin-top:4px}.term{padding:6px 0;border-bottom:1px solid #eee7dc;font-size:12px}.term strong{font-size:15px}.term small{color:#66766f}.citations{display:inline-flex;gap:6px;flex-wrap:wrap}
	.bottom{padding:10px 24px 18px;border-top:1px solid #ddd8cd;background:#fffdf7;border-radius:0 0 17px 17px}.bottom details{font-size:11px;color:#596a70;margin-bottom:9px}.bottom summary{cursor:pointer}.bottom label{display:grid;gap:4px;margin-top:8px}.bottom label small{font-weight:400}.bottom input,.bottom select{min-height:36px;padding:7px 9px;border:1px solid #c9cec7;border-radius:8px;background:white;color:#263442}.bottom form{display:flex;gap:7px}.bottom form input{flex:1;min-width:0}.bottom form button{width:36px;border-radius:8px;background:#263a46;color:white;font-size:18px}.bottom button:disabled{opacity:.5}.follow-answer{max-height:120px;overflow:auto;font-size:12px}.follow-answer p{margin:5px 0}
	@media (max-width:700px){.folio{top:auto;left:0;right:0;bottom:0;width:100%;height:min(78dvh,720px);border-radius:18px 18px 0 0}.bottom{border-radius:0}.content{padding:0 18px}header,.bottom{padding-left:18px;padding-right:18px}}
</style>
