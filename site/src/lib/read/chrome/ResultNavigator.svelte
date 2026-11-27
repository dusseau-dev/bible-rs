<script lang="ts">
	import { getApp } from '../app.svelte';
	import { Capsule, Icon } from '../ui';

	/** Below the toolbar (and any column heads), as far down as the text's first line would be. */
	const PAGE_TOP = 24;

	let { top }: { top: number } = $props();

	const app = getApp();
	const position = $derived(app.search.position);
</script>

<!-- While a search has results: "Result 5 of 7", direction controls and a hint, floating over the top of the
     text. -->
{#if position}
	<div class="navigator" style:top="{top + PAGE_TOP}px">
		<Capsule label="Search results">
			<span class="label" aria-live="polite">Result {position.index} of {position.total}</span>
			<button
				type="button"
				class="stepper"
				title="Previous result (↑ in the search field)"
				aria-label="Previous search result"
				onclick={() => app.dispatch({ type: 'searchStep', delta: -1 })}
			>
				<Icon name="chevron-up" size={14} heavy />
			</button>
			<button
				type="button"
				class="stepper"
				title="Next result (↓ in the search field)"
				aria-label="Next search result"
				onclick={() => app.dispatch({ type: 'searchStep', delta: 1 })}
			>
				<Icon name="chevron-down" size={14} heavy />
			</button>
			<span class="divider"></span>
			<span class="hint">Esc to clear</span>
		</Capsule>
	</div>
{/if}

<style>
	.navigator {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		pointer-events: none;
		z-index: 2;
	}

	.navigator > :global(*) {
		pointer-events: auto;
		padding: 0 8px 0 14px;
	}

	.label {
		color: var(--ink-2);
		font: 500 12px/16px var(--font-ui);
		white-space: nowrap;
	}

	.stepper {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		margin-left: 8px;
		border-radius: 50%;
		color: var(--ink-2);
	}

	@media (hover: hover) and (pointer: fine) {
		.stepper:hover {
			background: var(--fill);
		}
	}

	.stepper:active {
		background: var(--fill-strong);
	}

	/* Each direction needs a full finger-sized target, not half of one button. */
	@media (pointer: coarse) {
		.stepper { min-width:44px; min-height:44px; margin-left:4px; }
	}

	.divider {
		width: 1px;
		height: 16px;
		margin: 0 8px;
		background: var(--separator);
	}

	.hint {
		color: var(--ink-3);
		font: var(--type-small);
		white-space: nowrap;
	}
</style>
