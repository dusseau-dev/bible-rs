<script lang="ts">
	import { getApp } from '../app.svelte';
	import { HIGHLIGHT_COLORS } from '../core';
	import { Icon, Popover } from '../ui';
	import { pointRect } from '../ui/float';

	const app = getApp();
	const current = $derived(app.selectionColor());
	let colors = $state(false);
	const anchor = () => app.reader?.selectionRect() ?? (app.verseMenu ? pointRect(app.verseMenu.x, app.verseMenu.y) : null);
	const close = () => { app.verseMenu = null; app.selectionMore = false; };
	function action(mode: 'ask' | 'explain' | 'define') {
		app.selectionMore = false;
		app.selectionAction = mode;
		app.verseMenu = null;
	}
	function more(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		app.verseMenu = { x: rect.left, y: rect.top };
		app.selectionMore = !app.selectionMore;
	}
</script>

<Popover {anchor} side="top" align="center" gap={10} autofocus={false} onclose={() => { if (!app.selectionMore) close(); }} label="Selected passage actions" radius={14} class="selection-toolbar">
	<div class="row" role="group" aria-label="Passage actions">
		<button type="button" class="ask" title="Ask about this passage" onclick={() => action('ask')}>Ask<span class="caret" aria-hidden="true"></span></button>
		<span class="divider" aria-hidden="true"></span>
		<button type="button" title="What it means here, and why it is here" onclick={() => action('explain')}>
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4" /></svg>Explain
		</button>
		<button type="button" title="The words, as this author uses them" onclick={() => action('define')}>
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20M8 13l4-7 4 7M9.1 11h5.7" /></svg>Define
		</button>
		<button type="button" class="icon" class:active={app.selectionMore} aria-label="More passage actions" title="More actions" aria-expanded={app.selectionMore} onclick={more}><Icon name="ellipsis" size={16} /></button>
		<span class="divider" aria-hidden="true"></span>
		<button type="button" class="icon" aria-label="Choose highlight color" title="Highlight colours" aria-expanded={colors} onclick={() => colors = !colors}>
			<span class="marker"><Icon name="highlighter" size={15} /><span class="dot" style:background={current ? `var(--swatch-${current})` : 'var(--swatch-yellow)'}></span></span>
		</button>
		<button type="button" class="icon" aria-label="Add or edit note" title="Add a note in your own words" onclick={() => { close(); app.dispatch({ type: 'editSelectedNote' }); }}>
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 21h8M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /></svg>
		</button>
	</div>
	{#if colors}
		<div class="colors" role="group" aria-label="Highlight colors">
			{#each HIGHLIGHT_COLORS as color}<button type="button" aria-label="{app.highlightName(color)} highlight" aria-pressed={current === color} onclick={() => { app.dispatch({ type: 'highlight', color: current === color ? null : color }); colors = false; }}><span style:background="var(--swatch-{color})"></span></button>{/each}
			<button type="button" class="clear" aria-label="Remove highlight" onclick={() => { app.dispatch({ type: 'highlight', color: null }); close(); }}>×</button>
		</div>
	{/if}
	<span class="arrow" aria-hidden="true"></span>
</Popover>

<style>
	:global(.popover.frame.selection-toolbar) { --lens-bg:#eee8dc; --lens-fg:#292c29; --lens-mute:#7c7d72; background:var(--lens-bg); color:var(--lens-fg); padding:4px; overflow:visible; box-shadow:0 8px 24px #0003,0 0 0 1px #0001; }
	.row { display:flex; align-items:center; gap:2px; max-width:calc(100vw - 32px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)); overflow-x:auto; overscroll-behavior-x:contain; scrollbar-width:none; }
	.row::-webkit-scrollbar { display:none; }
	button { display:inline-flex; flex:none; align-items:center; justify-content:center; gap:6px; min-height:32px; padding:0 10px; border-radius:9px; color:inherit; white-space:nowrap; font:500 13px/20px var(--font-ui); }
	button:active, button.active { background:#00000012; }
	button:focus-visible { outline:2px solid var(--lens-mute); outline-offset:-2px; background:#0000000d; }
	button :global(svg) { flex:none; color:var(--lens-mute); }
	.ask { gap:8px; padding-left:12px; }
	.caret { width:5px; height:5px; border-right:1.5px solid currentColor; border-bottom:1.5px solid currentColor; transform:translateY(-2px) rotate(45deg); opacity:.7; }
	.divider { flex:none; width:1px; height:16px; background:#b4c0c24d; margin:0 3px; }
	.icon { width:32px; padding:0; }
	.marker { position:relative; display:flex; }
	.dot { position:absolute; bottom:-3px; right:-3px; width:7px; height:7px; border-radius:50%; box-shadow:0 0 0 2px var(--lens-bg); }
	.colors { display:flex; flex-wrap:wrap; gap:2px; padding-top:4px; max-width:100%; }
	.colors button { width:32px; padding:0; }
	.colors button span { width:16px; height:16px; border-radius:50%; }
	.colors button[aria-pressed='true'] span { outline:1.5px solid var(--lens-fg); outline-offset:3px; }
	.clear { font-size:20px; }
	.arrow { position:absolute; width:10px; height:10px; left:calc(50% - 5px); bottom:-4px; transform:rotate(45deg); background:var(--lens-bg); z-index:-1; }
	:global(.selection-toolbar[data-side='bottom']) .arrow { top:-4px; bottom:auto; }
	@media (hover:hover) and (pointer:fine) { button:hover { background:#0000000d; } button:hover :global(svg) { color:var(--lens-fg); } }
	@media (pointer:coarse) {
		.row { gap:0; }
		button { padding:0 5px; gap:4px; }
		.ask { padding:0 7px; gap:6px; }
		.divider { margin:0 2px; }
		button, .icon, .colors button { min-width:44px; min-height:44px; }
		.icon, .colors button { padding:0; }
	}
</style>
