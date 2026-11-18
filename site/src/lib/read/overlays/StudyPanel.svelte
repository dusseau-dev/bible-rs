<script module lang="ts">
	// Deliberately memory only: closing the tab discards the user's key.
	let sessionKey = '';
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { getApp } from '../app.svelte';
	import type { StudyClaim, StudyLayer, StudyResult, StudySource, Tradition } from '../study';
	import { Sheet } from '../ui';

	const app = getApp();
	const passage = app.studyPassage!;
	const oldTestament = passage.book < 39;
	const tabs: { id: Tradition | 'all'; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'protestant', label: 'Protestant' },
		{ id: 'catholic', label: 'Catholic' },
		{ id: 'orthodox', label: 'Orthodox' },
		...(oldTestament ? [{ id: 'jewish' as const, label: 'Jewish' }] : [])
	];
	const titles: Record<StudyLayer, string> = {
		text: 'The text',
		history: 'Historical context',
		language: 'Language',
		interpretation: 'Interpretations',
		uncertainty: 'Evidence and uncertainty'
	};
	const questions: Record<StudyLayer, string> = {
		text: 'What does this passage say in its paragraph?',
		history: 'What do we know about its setting and audience?',
		language: 'Do Hebrew or Greek terms affect how it reads?',
		interpretation: 'How do identifiable sources understand it?',
		uncertainty: 'Where does the evidence end or disagreement begin?'
	};
	let result = $state<StudyResult | null>(null);
	let loading = $state(false);
	let error = $state('');
	let apiKey = $state(sessionKey);
	let style = $state<'standard' | 'simple'>('standard');
	let tradition = $state<Tradition | 'all'>('all');
	let question = $state('');
	let asked = $state('');
	let showAllTerms = $state(false);
	let controller: AbortController | null = null;
	const close = () => { controller?.abort(); app.studyPassage = null; };
	const visible = (source: StudySource) => tradition === 'all' || source.tradition === tradition;
	const cited = (ids: string[]) => ids.map((id) => result?.sources.find((source) => source.id === id)).filter((source): source is StudySource => Boolean(source));
	const claims = (layer: StudyLayer): StudyClaim[] => (result?.claims ?? []).filter((claim) => claim.layer === layer && (tradition === 'all' || claim.tradition === tradition));
	const sources = (kinds: StudySource['kind'][]): StudySource[] => (result?.sources ?? []).filter((source) => kinds.includes(source.kind) && visible(source));
	const importantTerms = $derived((result?.terms ?? []).filter((term) => !/^(the|and|for|in|to|of|a|an|who|that|but|not|him|he|is|was)[.,;!?]?$/i.test(term.gloss.trim())));

	async function load(mode: 'open' | 'ask' = 'open') {
		controller?.abort();
		const current = new AbortController();
		controller = current;
		loading = true;
		error = '';
		if (mode === 'ask') asked = question.trim();
		try {
			const response = await fetch('/api/study', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ passage, mode, question: mode === 'ask' ? asked : undefined, style, openaiKey: apiKey.trim() || undefined }),
				signal: current.signal,
				cache: 'no-store'
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || 'The study could not load');
			result = data as StudyResult;
			sessionKey = apiKey.trim();
		} catch (cause) {
			if (current.signal.aborted) return;
			error = cause instanceof Error ? cause.message : 'The study could not load';
		} finally {
			if (controller === current) loading = false;
		}
	}

	onMount(() => { void load(); return () => controller?.abort(); });
</script>

<Sheet label="Go deeper" onclose={close} width={820} height={820} top={24} focusSheet class="study-sheet">
	<header class="header">
		<div>
			<p class="eyebrow">PASSAGE STUDY</p>
			<h2>{result?.reference ?? 'Go deeper'}</h2>
		</div>
		<button type="button" class="close" aria-label="Close study" onclick={close}>×</button>
	</header>
	<div class="scroll">
		<p class="intro">Read the passage, inspect its sources, and keep historical claims, interpretation, and preaching distinct.</p>
		<div class="controls">
			<label class="key-field">Your OpenAI API key <span>(stored only in tab memory; sent through this site's server to OpenAI for each request)</span>
				<input type="password" autocomplete="off" spellcheck="false" bind:value={apiKey} placeholder="Optional for summary and questions" />
			</label>
			<div class="control-row">
				<label>Explanation <select bind:value={style}><option value="standard">Standard</option><option value="simple">Simple</option></select></label>
				<button type="button" class="primary" disabled={loading} onclick={() => load()}>{loading ? 'Loading…' : 'Update study'}</button>
			</div>
		</div>
		{#if error}<p class="alert" role="alert">{error}</p>{/if}
		{#if result}
			{#if result.message}<p class="notice">{result.message}</p>{/if}
			<nav class="tabs" aria-label="Interpretive tradition">
				{#each tabs as tab}
					<button type="button" class:active={tradition === tab.id} aria-current={tradition === tab.id ? 'page' : undefined} onclick={() => tradition = tab.id}>{tab.label}</button>
				{/each}
			</nav>

			<section class="section">
				<h3>The text <small>What does this passage say in context?</small></h3>
				<p class="source-label">World English Bible · public domain</p>
				<blockquote>{result.passageText}</blockquote>
				<details><summary>Read the surrounding paragraph</summary><blockquote>{result.contextText}</blockquote></details>
				{#each claims('text') as claim}<p class="claim">{claim.text} <span class="citations">{#each cited(claim.sourceIds) as source}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>{/each}</span></p>{/each}
			</section>

			{#each ['history', 'language', 'interpretation', 'uncertainty'] as layer (layer)}
				{@const section = layer as StudyLayer}
				<section class="section">
					<h3>{titles[section]} <small>{questions[section]}</small></h3>
					{#each claims(section) as claim}
						<p class="claim">{claim.text} <span class="citations">{#each cited(claim.sourceIds) as source}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>{/each}</span></p>
					{/each}
					{#if section === 'history'}
						{#each sources(['academic']).slice(0, 5) as source}<article class="source"><div><strong>{source.title}</strong><span class="tag">{source.scope === 'direct' ? 'Direct passage' : 'Related'}</span></div><p>{source.excerpt}</p><a href={source.url} target="_blank" rel="noopener noreferrer">{source.author} ↗</a></article>{/each}
						{#if !claims(section).length && !sources(['academic']).length}<p class="empty">No sourced historical reconstruction is available for this passage yet.</p>{/if}
					{:else if section === 'language'}
						{#if result.terms.length}<p class="helper">Lexical glosses are starting points; they do not determine a word’s meaning in this verse. STEPBible data: <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.</p><div class="terms">{#each (showAllTerms ? result.terms : importantTerms.slice(0, 12)) as term}<div class="term"><strong>{term.original}</strong><span>{term.transliteration || term.lemma}</span><span>{term.gloss}</span><small>v. {term.verse} · <a href={result.sources.find((source) => source.id === term.sourceId)?.url} target="_blank" rel="noopener noreferrer">STEPBible ↗</a></small></div>{/each}</div>{#if result.terms.length > 12}<button type="button" class="more" onclick={() => showAllTerms = !showAllTerms}>{showAllTerms ? 'Show fewer words' : `Show all ${result.terms.length} tagged words`}</button>{/if}{:else}<p class="empty">No tagged language data for this passage.</p>{/if}
					{:else if section === 'interpretation'}
						{#each sources(['commentary']).slice(0, 6) as source}<article class="source"><div><strong>{source.title}</strong><span class="tag">{source.scope === 'direct' ? 'Direct passage' : 'Related'}</span></div><p>{source.excerpt}</p><a href={source.url} target="_blank" rel="noopener noreferrer">{source.author} ↗</a></article>{/each}
						{#if !claims(section).length && !sources(['commentary']).length}<p class="empty">No attributable {tradition === 'all' ? '' : `${tradition} `}interpretation was found for this passage.</p>{/if}
					{:else if !claims(section).length}<p class="empty">The available sources do not establish a clear point of disagreement. Read the linked evidence before drawing a conclusion.</p>{/if}
				</section>
			{/each}
			{#if sources(['study_note']).length}
				<section class="section"><h3>Passage-linked study notes <small>Attributed notes for further reading; their claims are separate from historical reconstruction.</small></h3>
					{#each sources(['study_note']).slice(0, 6) as source}<details class="source"><summary><strong>{source.title}</strong><span class="tag">{source.scope === 'direct' ? 'Direct passage' : 'Wider context'}</span></summary><p>{source.excerpt}</p><a href={source.url} target="_blank" rel="noopener noreferrer">{source.author} ↗</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a></details>{/each}
				</section>
			{/if}

			<section class="section">
				<h3>Sermons and lectures <small>Where can I watch someone explain this passage?</small></h3>
				{#if result.videos.length}
					{#each result.videos as video}<article class="video"><a href={video.url} target="_blank" rel="noopener noreferrer"><strong>{video.title} ↗</strong></a><p>{video.channel} · {video.scope === 'direct' ? 'Direct passage coverage' : 'Related topic'} · Video link only; spoken content not verified</p></article>{/each}
				{:else}<p class="empty">No reviewed, passage-specific video is available yet.</p>{/if}
			</section>

			<section class="section ask">
				<h3>Ask about this passage <small>Answers use the evidence shown above.</small></h3>
				<form onsubmit={(event) => { event.preventDefault(); if (question.trim() && !loading) void load('ask'); }}>
					<input aria-label="Question" maxlength="500" bind:value={question} placeholder="What would you like to understand?" />
					<button type="submit" class="primary" disabled={loading || !question.trim()}>Ask</button>
				</form>
				{#if asked && result.answer}<div class="answer"><strong>{asked}</strong><p>{result.answer.text}</p><div class="citations">{#each cited(result.answer.sourceIds) as source}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>{/each}</div></div>{/if}
			</section>
		{/if}
	</div>
</Sheet>

<style>
	.header { display:flex; justify-content:space-between; align-items:start; gap:16px; padding:22px 28px 14px; border-bottom:1px solid var(--line); }
	.eyebrow { margin:0 0 5px; color:var(--ink-3); font-size:10px; font-weight:700; letter-spacing:.13em; }
	h2 { margin:0; font:var(--type-title); }
	.close { font-size:28px; line-height:1; color:var(--ink-3); padding:0 4px; }
	.scroll { overflow:auto; padding:0 28px 28px; }
	.intro { color:var(--ink-2); font-size:14px; line-height:1.55; }
	.controls { display:grid; gap:12px; padding:15px; background:var(--fill); border-radius:12px; }
	.key-field { display:grid; gap:6px; font-size:13px; font-weight:600; }
	.key-field span { color:var(--ink-3); font-weight:400; }
	input, select { min-height:36px; padding:7px 10px; border:1px solid var(--line); border-radius:8px; background:var(--surface); color:var(--ink); font:inherit; }
	.key-field input { width:100%; }
	.control-row { display:flex; align-items:end; justify-content:space-between; gap:12px; }
	.control-row label { display:grid; gap:5px; font-size:12px; }
	.primary { min-height:36px; padding:7px 14px; border-radius:8px; color:var(--surface); background:var(--ink); font-weight:600; }
	.primary:disabled { opacity:.5; }
	.notice, .alert { padding:11px 13px; border-radius:9px; background:var(--fill); color:var(--ink-2); font-size:13px; }
	.alert { color:#a33; }
	.tabs { display:flex; gap:4px; overflow:auto; margin:22px 0 4px; padding-bottom:6px; }
	.tabs button { flex:none; padding:7px 11px; border-radius:20px; color:var(--ink-2); font-size:12px; }
	.tabs button.active { background:var(--fill-strong); color:var(--ink); font-weight:700; }
	.section { padding:19px 0 21px; border-top:1px solid var(--line); }
	h3 { display:grid; gap:5px; margin:0 0 14px; font-size:17px; }
	h3 small { font-size:12px; font-weight:400; color:var(--ink-3); }
	.source-label, .helper, .empty { color:var(--ink-3); font-size:12px; }
	blockquote { margin:10px 0; padding:5px 0 5px 16px; border-left:2px solid var(--line); white-space:pre-line; line-height:1.65; font-family:Georgia,serif; font-size:15px; }
	details { margin-top:10px; font-size:12px; color:var(--ink-2); }
	summary { cursor:pointer; }
	.claim { font-size:14px; line-height:1.6; }
	.citations { display:inline-flex; gap:8px; flex-wrap:wrap; font-size:11px; }
	a { color:var(--accent); text-decoration:none; }
	a:hover { text-decoration:underline; }
	.source { margin:10px 0; padding:12px 14px; border:1px solid var(--line); border-radius:10px; }
	.source div { display:flex; justify-content:space-between; gap:8px; }
	.source summary { display:flex; justify-content:space-between; gap:8px; cursor:pointer; }
	.source strong { font-size:13px; }
	.source p { margin:8px 0; font-size:13px; line-height:1.5; }
	.source a { font-size:11px; }
	.tag { color:var(--ink-3); font-size:10px; white-space:nowrap; }
	.terms { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; }
	.term { display:grid; gap:2px; padding:9px; border:1px solid var(--line); border-radius:8px; font-size:12px; }
	.term strong { font-size:16px; }
	.term small, .term span:nth-child(2) { color:var(--ink-3); }
	.more { margin-top:10px; font-size:12px; color:var(--accent); }
	.video { padding:10px 0; }
	.video p { margin:5px 0; color:var(--ink-3); font-size:12px; }
	.ask form { display:flex; gap:8px; }
	.ask input { flex:1; min-width:0; }
	.answer { margin-top:16px; padding:14px; border-radius:10px; background:var(--fill); font-size:13px; line-height:1.6; }
	.answer p { margin:7px 0; }
	@media (max-width:600px) { .header { padding:17px 18px 12px; } .scroll { padding:0 18px 22px; } .source div { display:block; } .tag { display:block; margin-top:5px; } }
</style>
