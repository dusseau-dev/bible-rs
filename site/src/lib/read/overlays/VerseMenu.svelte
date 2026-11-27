<!--
	The verse menu (verse_menu.rs): right-click a verse for the highlight swatches (1–6, 0 clears),
	note, bookmark, copy, share, compare and parallel.
-->
<script lang="ts">
	import { getApp } from '../app.svelte';
	import { HIGHLIGHT_COLORS } from '../core';
	import type { Category } from '../study-items';
	import { cmdText, isMac, shortcutText } from '../keyboard';
	import { Icon, Menu, MenuHeader, MenuItem, MenuSeparator } from '../ui';
	import { pointRect } from '../ui/float';

	const WIDTH = 306;

	const app = getApp();
	const at = app.verseMenu!;
	const anchor = document.querySelector<HTMLElement>('.selection-toolbar [aria-label="More passage actions"]') ?? pointRect(at.x, at.y);
	const studyActions: { label:string; description:string; icon:'history' | 'link' | 'search' | 'quote' | 'book'; category:Category }[] = [
		{ label:'History', description:'The people, places, and world behind it', icon:'history', category:'history' },
		{ label:'Related', description:'Where else Scripture takes this up', icon:'link', category:'related' },
		{ label:'Research', description:'Academic research and scholarship', icon:'search', category:'academic' },
		{ label:'Testimonials', description:'Personal stories connected to the passage', icon:'quote', category:'testimonials' },
		{ label:'Sermons', description:'Sermons and teaching on YouTube', icon:'book', category:'videos' }
	];

	const refs = $derived(app.selectedRefs());
	const marks = $derived(refs.length ? app.marks(app.settings.translation, app.chapterIndex(refs[0])) : null);
	const first = $derived(refs.length ? marks?.get(refs[0].verse) : undefined);
	/** The colour all of the selection has (the chosen words, or the verses whole), if one. */
	const current = $derived(app.selectionColor());
	const keys = (id: string) => shortcutText(id, app.settings.shortcuts);

	const close = () => { app.selectionMore = false; app.verseMenu = null; };
	const run = (a: Parameters<typeof app.dispatch>[0]) => {
		close();
		app.dispatch(a);
	};

	$effect(() => {
		if (!refs.length) close();
	});
</script>

<Menu
	{anchor}
	side="top"
	align="end"
	gap={8}
	quiet
	width={WIDTH}
	onclose={close}
	label="Verse"
	class="selection-overflow"
	highlight={app.demo.menu === 'first' ? 0 : undefined}
>
	<MenuItem icon="text-size" label="Simplify" description="The same idea in plain words" onclick={() => { close(); app.selectionAction = 'simplify'; }} />
	{#each studyActions as action}
		<MenuItem icon={action.icon} label={action.label} description={action.description} onclick={() => run({ type:'goDeeper', category:action.category })} />
	{/each}
	<MenuSeparator />
	<MenuHeader label="Highlight" />
	<div class="swatches">
		{#each HIGHLIGHT_COLORS as c, k (c)}
			<button
				type="button"
				class={['swatch', { on: current === c }]}
				style:--swatch="var(--swatch-{c})"
				tabindex="-1"
				title="{app.highlightName(c)} ({k + 1})"
				aria-label="{app.highlightName(c)} highlight"
				aria-pressed={current === c}
				onclick={() => run({ type: 'highlight', color: current === c ? null : c })}
			>
				{#if current === c}<Icon name="check" size={14} />{/if}
			</button>
		{/each}
		<button
			type="button"
			class="clear"
			tabindex="-1"
			title="Remove highlight (0)"
			aria-label="Remove highlight"
			onclick={() => run({ type: 'highlight', color: null })}
		>
			<Icon name="slash-circle" size={20} />
		</button>
	</div>
	<MenuSeparator />
	<MenuItem
		icon="note"
		label={first?.note ? 'Edit Note…' : 'Add Note…'}
		shortcut={keys('note')}
		onclick={() => run({ type: 'editSelectedNote' })}
	/>
	<MenuItem
		icon="bookmark"
		label={first?.bookmark ? 'Remove Bookmark' : 'Bookmark'}
		shortcut={keys('bookmark')}
		onclick={() => run({ type: 'toggleBookmark' })}
	/>
	<MenuSeparator />
	<MenuItem icon="search" label="Go deeper" description="All passage study sources together" onclick={() => run({ type:'goDeeper' })} />
	<MenuSeparator />
	<MenuItem icon="copy" label="Copy" shortcut={cmdText('C')} onclick={() => run({ type: 'copyText' })} />
	<MenuItem icon="quote" label="Copy with Reference" shortcut={keys('copy')} onclick={() => run({ type: 'copy' })} />
	<MenuItem icon="share" label="Share as Image…" onclick={() => run({ type: 'shareImage' })} />
	<MenuSeparator />
	<MenuItem icon="compare" label="Compare Translations" shortcut={keys('compare')} onclick={() => run({ type: 'compare' })} />
	<MenuItem icon="columns" label="Open in Parallel" shortcut={keys('parallel')} onclick={() => run({ type: 'toggleParallel' })} />
	<MenuSeparator />
	<MenuItem icon="text-cursor" label="Select Verse Range" shortcut={isMac ? '⇧-click' : 'Shift-click'} disabled onclick={() => {}} />
</Menu>

<style>
	:global(.popover.menu.selection-overflow) { --ink-3:var(--ink-2); background:var(--surface); border:1px solid var(--border); border-radius:16px; max-height:min(540px,60dvh,var(--visual-height,100dvh)); z-index:61; }
	:global(.selection-overflow .item:focus .description), :global(.selection-overflow .item:focus .shortcut) { color:var(--ink); }
	/* 20 pt swatches 10 apart, 6 above and 8 below, from the text column. */
	.swatches {
		display: flex;
		gap: 10px;
		height: 34px;
		padding: 6px var(--menu-item-padding) 8px;
	}

	.swatch,
	.clear {
		position: relative;
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		isolation: isolate;
	}

	.swatch {
		background: var(--swatch);
		box-shadow: inset 0 0 0 0.5px rgb(0 0 0 / 0.18);
		color: #fff;
	}

	.swatch::before,
	.clear::before {
		content: '';
		position: absolute;
		inset: -3px;
		border-radius: 50%;
		z-index: -1;
	}

	@media (hover: hover) and (pointer: fine) {
		.swatch:hover:not(.on)::before,
		.clear:hover::before {
			background: var(--fill-strong);
		}
	}

	.swatch.on::before {
		inset: -3.5px;
		box-shadow: inset 0 0 0 1.5px var(--ink);
	}

	.clear {
		color: var(--ink-3);
	}
	@media (pointer:coarse) {
		.swatches { height:auto; flex-wrap:wrap; gap:4px; }
		.swatch, .clear { width:44px; height:44px; }
	}
</style>
