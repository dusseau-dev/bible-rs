<script lang="ts">
	import { onMount } from 'svelte';
	import { getApp } from '../app.svelte';
	import type { StudyPassage, StudyResult } from '../study';
	import { Icon, Popover } from '../ui';

	const app = getApp();
	const refs = app.selectedRefs();
	const passage: StudyPassage = { book: refs[0].book, chapter: refs[0].chapter, firstVerse: refs[0].verse, lastVerse: refs[refs.length - 1].verse };
	const signature = `${passage.book}:${passage.chapter}:${passage.firstVerse}:${passage.lastVerse}`;
	let mode = $state<'ask' | 'explain' | 'simplify'>(app.selectionAction!);
	let question = $state('');
	let result = $state<StudyResult | null>(null);
	let error = $state('');
	let loading = $state(false);
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
		if (mode === 'ask' && !question.trim()) return;
		controller?.abort();
		const current = new AbortController();
		controller = current;
		const request = ++serial;
		loading = true; error = ''; result = null;
		try {
			const response = await fetch('/api/study', {
				method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store', signal: current.signal,
				body: JSON.stringify({ passage, mode: mode === 'ask' ? 'ask' : 'explain', question: mode === 'ask' ? question.trim() : undefined, style: mode === 'simplify' ? 'simple' : 'standard' })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || 'The explanation could not load');
			if (request !== serial) return;
			result = data as StudyResult;
		} catch (cause) {
			if (!current.signal.aborted && request === serial) error = cause instanceof Error ? cause.message : 'The explanation could not load';
		} finally {
			if (request === serial) loading = false;
		}
	}

	function switchMode(next: typeof mode) {
		if (next === mode) return;
		controller?.abort(); serial++; result = null; error = ''; loading = false; mode = next;
		if (next !== 'ask') void load();
	}

	onMount(() => { if (mode !== 'ask') void load(); return () => controller?.abort(); });
</script>

<Popover {anchor} side="bottom" align="center" gap={10} onclose={close} label="Passage {mode}" radius={15} class="quick-study">
	<div class="card">
		<div class="head"><strong>{mode === 'ask' ? 'Ask about this passage' : mode === 'simplify' ? 'Explain simply' : 'Explain'}</strong><button type="button" class="close" aria-label="Close" onclick={close}><Icon name="close" size={18} /></button></div>
		<div class="actions" role="group" aria-label="Passage study actions">
			<button type="button" class:active={mode === 'ask'} aria-pressed={mode === 'ask'} onclick={() => switchMode('ask')}>Ask</button>
			<button type="button" class:active={mode === 'explain'} aria-pressed={mode === 'explain'} onclick={() => switchMode('explain')}>Explain</button>
			<button type="button" class:active={mode === 'simplify'} aria-pressed={mode === 'simplify'} onclick={() => switchMode('simplify')}>Explain simply</button>
			<button type="button" onclick={() => { close(); app.dispatch({ type: 'goDeeper' }); }}>Deep study</button>
		</div>
		{#if mode === 'ask'}
			<form onsubmit={(event) => { event.preventDefault(); void load(); }}>
				<input aria-label="Question about passage" maxlength="500" bind:value={question} placeholder="Ask about this passage" />
				<button type="submit" class="submit" disabled={loading || !question.trim()} aria-label="Send question">Ask</button>
			</form>
		{/if}
		{#if loading}<p class="message">Reading the sources…</p>{/if}
		{#if error}<p class="message error" role="alert">{error} <button type="button" onclick={() => void load()}>Retry</button></p>{/if}
		{#if result?.message}<p class="message">{result.message}</p>{/if}
		{#if result}
			{#if result.answer || result.guide.some((step) => step.answer)}<p class="source-note">Based on the World English Bible.</p>{/if}
			{#if mode === 'ask' && result.answer}<p class="answer">{result.answer.text}</p><div class="citations">{#each cited(result.answer.sourceIds) as source}<a href={source?.url} target="_blank" rel="noopener noreferrer">{source?.title} <Icon name="external" size={12} /></a>{/each}</div>
			{:else if mode !== 'ask'}
				{#each result.guide.filter((step) => step.answer).slice(0, mode === 'simplify' ? 2 : 4) as step}<p class="answer"><b>{step.id === 'christ' ? 'Connect to Christ' : step.id[0].toUpperCase() + step.id.slice(1)}.</b> {step.answer}</p><div class="citations">{#each cited(step.sourceIds) as source}<a href={source?.url} target="_blank" rel="noopener noreferrer">{source?.title} <Icon name="external" size={12} /></a>{/each}</div>{/each}
				{#if !result.guide.some((step) => step.answer) && result.answer}<p class="answer">{result.answer.text}</p><div class="citations">{#each cited(result.answer.sourceIds) as source}<a href={source?.url} target="_blank" rel="noopener noreferrer">{source?.title} <Icon name="external" size={12} /></a>{/each}</div>{/if}
			{/if}
			{#if mode === 'ask' && !result.answer && !result.message}<p class="message">The sources do not support an answer to that question yet.</p>{/if}
		{/if}
	</div>
</Popover>

<style>
	:global(.quick-study) { background:#fffdf7 !important; border:1px solid #d6d1c4; box-shadow:0 15px 34px #0002; }
	.card { width:min(560px,calc(100vw - 32px)); max-height:min(70dvh,650px); overflow:auto; padding:18px; color:#263442; }
	.head { display:flex; justify-content:space-between; align-items:center; gap:12px; font:18px Georgia,serif; }
	.head .close { display:grid; place-items:center; width:32px; height:32px; color:#52616a; border-radius:8px; }
	.head .close:hover { background:#f0eee7; }
	.actions { display:flex; gap:16px; overflow-x:auto; border-bottom:1px solid #ddd8cd; margin:10px 0 14px; scrollbar-width:none; }
	.actions::-webkit-scrollbar { display:none; }
	.actions button { flex:none; min-height:40px; border-bottom:2px solid transparent; color:#52616a; font-size:12px; white-space:nowrap; }
	.actions button:hover,.actions button.active { color:#264c46; }
	.actions button.active { border-bottom-color:#396e61; font-weight:700; }
	form { display:flex; gap:8px; }
	form input { min-height:44px; flex:1; min-width:0; padding:9px 12px; border:1px solid #c9cec7; border-radius:9px; background:white; color:#263442; font:14px Arial,sans-serif; }
	.submit { min-width:58px; border-radius:9px; background:#263a46; color:white; font-size:13px; font-weight:700; }
	.submit:disabled { opacity:.5; }
	.citations { display:flex; flex-wrap:wrap; gap:8px; }
	.source-note,.message { color:#596a70; font-size:12px; font-weight:400; }
	.answer { font:15px/1.55 Georgia,serif; }
	.citations a { display:inline-flex; align-items:center; gap:3px; color:#365e56; font-size:11px; }
	.error { color:#9d3e35; }
	@media (max-width:600px) { :global(.quick-study) { left:8px !important; right:8px !important; top:auto !important; bottom:8px !important; border-radius:20px !important; } .card { width:auto; max-height:min(70dvh,650px); } form { flex-direction:column; } .submit { align-self:flex-start; min-width:92px; min-height:40px; } }
</style>
