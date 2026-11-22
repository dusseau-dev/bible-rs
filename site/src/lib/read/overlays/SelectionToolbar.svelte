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
	function action(mode: 'ask' | 'explain' | 'simplify') {
		app.selectionAction = mode;
		app.verseMenu = null;
	}
	function more(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		app.verseMenu = { x: rect.left, y: rect.bottom + 4 };
		app.selectionMore = true;
	}
</script>

<Popover {anchor} side="bottom" align="center" gap={9} autofocus={false} onclose={close} label="Selected passage actions" radius={16} class="selection-toolbar">
	<div class="row">
		<button type="button" onclick={() => action('ask')}>Ask</button>
		<span class="divider"></span>
		<button type="button" onclick={() => action('explain')}>✧ Explain</button>
		<button type="button" onclick={() => action('simplify')}>Simplify</button>
		<button type="button" class="more" aria-label="More passage actions" aria-expanded={false} onclick={more}>···</button>
		<span class="divider"></span>
		<button type="button" class="mark" aria-label="Choose highlight color" aria-expanded={colors} onclick={() => colors = !colors}><span class="dot" style:--swatch={current ? `var(--swatch-${current})` : 'var(--swatch-yellow)'}></span></button>
		<button type="button" class="mark" aria-label="Add or edit note" onclick={() => { close(); app.dispatch({ type: 'editSelectedNote' }); }}><Icon name="note" size={18} /></button>
	</div>
	{#if colors}
		<div class="colors" aria-label="Highlight colors">
			{#each HIGHLIGHT_COLORS as color}<button type="button" aria-label="{app.highlightName(color)} highlight" aria-pressed={current === color} style:--swatch="var(--swatch-{color})" onclick={() => { app.dispatch({ type: 'highlight', color: current === color ? null : color }); close(); }}></button>{/each}
			<button type="button" class="clear" aria-label="Remove highlight" onclick={() => { app.dispatch({ type: 'highlight', color: null }); close(); }}>×</button>
		</div>
	{/if}
</Popover>

<style>
	:global(.selection-toolbar) { background:#263a46 !important; color:#f6f0e5 !important; box-shadow:0 12px 28px #0003; }
	.row { display:flex; align-items:center; gap:2px; padding:6px; }
	button { min-height:40px; padding:9px 11px; border-radius:10px; color:inherit; white-space:nowrap; font-size:13px; }
	button:hover, button:focus-visible { background:#45606b; outline:none; }
	.divider { width:1px; height:23px; background:#71838a; margin:0 3px; }
	.more { background:#45606b; font-size:21px; line-height:15px; }
	.mark { padding:7px; display:grid; place-items:center; }
	.dot { display:block; width:20px; height:20px; border-radius:50%; background:var(--swatch); }
	.colors { display:flex; gap:7px; padding:4px 12px 12px; }
	.colors button { min-height:28px; width:28px; padding:0; border-radius:50%; background:var(--swatch); }
	.colors button[aria-pressed='true'] { outline:2px solid white; outline-offset:2px; }
	.colors .clear { background:#45606b; }
	@media (max-width:600px) { .row { flex-wrap:wrap; max-width:calc(100vw - 32px); } }
</style>
