<script lang="ts">
	import { onMount } from 'svelte';
	import { getApp } from '../app.svelte';
	import type { StudyPassage, StudyResult } from '../study';
	import { Popover } from '../ui';
	import { getStudyKey, setStudyKey } from './study-key';

	const app = getApp();
	const refs = app.selectedRefs();
	const passage: StudyPassage = { book: refs[0].book, chapter: refs[0].chapter, firstVerse: refs[0].verse, lastVerse: refs[refs.length - 1].verse };
	const signature = `${passage.book}:${passage.chapter}:${passage.firstVerse}:${passage.lastVerse}`;
	let mode = $state<'ask' | 'explain' | 'simplify'>(app.selectionAction!);
	let question = $state('');
	let apiKey = $state(getStudyKey());
	let result = $state<StudyResult | null>(null);
	let error = $state('');
	let loading = $state(false);
	let sourceInfo = $state(false);
	let controller: AbortController | null = null;
	let serial = 0;
	const anchor = () => app.reader?.selectionRect() ?? null;
	const close = () => { controller?.abort(); app.selectionAction = null; };
	const cited = (ids: string[]) => ids.map((id) => result?.sources.find((source) => source.id === id)).filter((source) => Boolean(source));

	$effect(() => {
		const current = app.selectedRefs();
		if (!current.length || `${current[0].book}:${current[0].chapter}:${current[0].verse}:${current[current.length - 1].verse}` !== signature) close();
	});

	async function load() {
		if (!apiKey.trim() || (mode === 'ask' && !question.trim())) return;
		controller?.abort();
		const current = new AbortController();
		controller = current;
		const request = ++serial;
		loading = true; error = ''; result = null;
		try {
			const response = await fetch('/api/study', {
				method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store', signal: current.signal,
				body: JSON.stringify({ passage, mode: mode === 'ask' ? 'ask' : 'explain', question: mode === 'ask' ? question.trim() : undefined, style: mode === 'simplify' ? 'simple' : 'standard', openaiKey: apiKey.trim() })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || 'The explanation could not load');
			if (request !== serial) return;
			result = data as StudyResult;
			setStudyKey(apiKey);
		} catch (cause) {
			if (!current.signal.aborted && request === serial) error = cause instanceof Error ? cause.message : 'The explanation could not load';
		} finally {
			if (request === serial) loading = false;
		}
	}

	function switchMode(next: typeof mode) {
		controller?.abort(); serial++; result = null; error = ''; loading = false; mode = next;
		if (next !== 'ask' && apiKey.trim()) void load();
	}

	onMount(() => { if (mode !== 'ask' && apiKey.trim()) void load(); return () => controller?.abort(); });
</script>

<Popover {anchor} side="bottom" align="center" gap={10} onclose={close} label="Passage {mode}" radius={15} class="quick-study">
	<div class="card">
		<div class="head"><strong>{mode === 'ask' ? 'Ask about this passage' : mode === 'simplify' ? 'Simplify' : 'Explain'}</strong><button type="button" aria-label="Close" onclick={close}>×</button></div>
		{#if mode === 'ask'}
			<form onsubmit={(event) => { event.preventDefault(); void load(); }}>
				<input aria-label="Question about passage" maxlength="500" bind:value={question} placeholder="Ask about this passage" />
				<button type="button" class="sources-button" aria-expanded={sourceInfo} onclick={() => sourceInfo = !sourceInfo}>◉ Sources</button>
				<button type="submit" class="submit" disabled={loading || !question.trim() || !apiKey.trim()} aria-label="Send question">↑</button>
			</form>
			{#if sourceInfo}<p class="source-note">Answers use the passage and linked study sources shown in Go deeper. Community stories are not used as evidence.</p>{/if}
			<div class="suggestions">{#each ['Why this detail?', 'Where is this echoed?', 'How does this point to Christ?'] as suggestion}<button type="button" onclick={() => question = suggestion}>{suggestion}</button>{/each}</div>
		{:else if !result && apiKey.trim() && !loading}<button type="button" class="generate" onclick={() => void load()}>Generate {mode === 'simplify' ? 'simple explanation' : 'explanation'}</button>{/if}
		{#if !apiKey.trim()}<label class="key">Your OpenAI API key <small>Kept only in this tab; sent through the site server for each request.</small><input type="password" autocomplete="off" bind:value={apiKey} oninput={(event) => setStudyKey(event.currentTarget.value)} placeholder="Enter key to use Ask and Explain" /></label>{/if}
		{#if loading}<p class="message">Reading the sources…</p>{/if}
		{#if error}<p class="message error" role="alert">{error} <button type="button" onclick={() => void load()}>Retry</button></p>{/if}
		{#if result?.message}<p class="message">{result.message}</p>{/if}
		{#if result}
			<p class="source-note">Explanation based on the World English Bible and linked sources.</p>
			{#if mode === 'ask' && result.answer}<p class="answer">{result.answer.text}</p><div class="citations">{#each cited(result.answer.sourceIds) as source}<a href={source?.url} target="_blank" rel="noopener noreferrer">{source?.title} ↗</a>{/each}</div>
			{:else if mode !== 'ask'}
				{#each result.guide.filter((step) => step.answer).slice(0, mode === 'simplify' ? 2 : 4) as step}<p class="answer"><b>{step.id === 'christ' ? 'Connect to Christ' : step.id[0].toUpperCase() + step.id.slice(1)}.</b> {step.answer}</p><div class="citations">{#each cited(step.sourceIds) as source}<a href={source?.url} target="_blank" rel="noopener noreferrer">{source?.title} ↗</a>{/each}</div>{/each}
				{#if !result.guide.some((step) => step.answer) && result.answer}<p class="answer">{result.answer.text}</p><div class="citations">{#each cited(result.answer.sourceIds) as source}<a href={source?.url} target="_blank" rel="noopener noreferrer">{source?.title} ↗</a>{/each}</div>{/if}
			{/if}
			{#if mode === 'ask' && !result.answer}<p class="message">The sources do not support an answer to that question yet.</p>{/if}
		{/if}
		<div class="footer"><button type="button" onclick={() => switchMode('explain')}>Explain</button><button type="button" onclick={() => switchMode('simplify')}>Simplify</button><button type="button" onclick={() => { close(); app.dispatch({ type: 'goDeeper' }); }}>Go deeper ↗</button></div>
	</div>
</Popover>

<style>
	:global(.quick-study) { background:#fffdf7 !important; border:1px solid #d6d1c4; box-shadow:0 15px 34px #0002; }
	.card { width:min(560px,calc(100vw - 32px)); max-height:min(70dvh,650px); overflow:auto; padding:18px; color:#263442; }
	.head { display:flex; justify-content:space-between; align-items:center; gap:12px; font:18px Georgia,serif; }
	.head button { font:24px Arial,sans-serif; color:#52616a; }
	form { display:flex; gap:8px; margin-top:16px; }
	form input,.key input { min-height:44px; flex:1; min-width:0; padding:9px 12px; border:1px solid #c9cec7; border-radius:9px; background:white; color:#263442; font:14px Arial,sans-serif; }
	.submit { width:44px; border-radius:9px; background:#263a46; color:white; font-size:20px; }
	.sources-button { padding:0 10px; border-radius:9px; background:#263a46; color:white; font-size:12px; white-space:nowrap; }
	.submit:disabled { opacity:.5; }
	.suggestions,.footer,.citations { display:flex; flex-wrap:wrap; gap:8px; }
	.suggestions { margin:12px 0 3px; }
	.suggestions button { padding:6px 8px; color:#365e56; background:#e7eee8; border-radius:6px; font-size:12px; }
	.key { display:grid; gap:5px; margin-top:16px; font-size:13px; font-weight:600; }
	.key small,.source-note,.message { color:#596a70; font-size:12px; font-weight:400; }
	.answer { font:15px/1.55 Georgia,serif; }
	.citations a { color:#365e56; font-size:11px; }
	.error { color:#9d3e35; }
	.generate { margin-top:16px; padding:8px 11px; background:#263a46; color:white; border-radius:8px; }
	.footer { border-top:1px solid #ddd8cd; margin-top:18px; padding-top:12px; justify-content:space-between; }
	.footer button { color:#365e56; font-size:12px; }
</style>
