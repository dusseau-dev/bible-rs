<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import { follow } from './follow';
	import type { IconName } from './icons';

	interface Props {
		icon?: IconName;
		label: string;
		description?: string;
		/** Keycaps at the trailing edge, as text ("⇧⌘C"). */
		shortcut?: string;
		disabled?: boolean;
		/** The current choice (a radio-like row): a check before the label. */
		checked?: boolean;
		/** Leaves the check column empty when no row in the menu has an icon. */
		checkColumn?: boolean;
		/** The current choice in a quiet menu: the selection colour behind it, no check. */
		selected?: boolean;
		/** The place the row opens (a chapter in another translation): a real link, which the
		 *  click still handles. */
		href?: string;
		onclick: (e: MouseEvent) => void;
		/** Something drawn before the label instead of an icon (a swatch). */
		lead?: Snippet;
		/** Something drawn at the trailing edge (a badge). */
		trailing?: Snippet;
	}

	let {
		icon,
		label,
		description,
		shortcut,
		disabled = false,
		checked,
		checkColumn = false,
		selected,
		href,
		onclick,
		lead,
		trailing
	}: Props = $props();

	const role = $derived(checked === undefined && selected === undefined ? 'menuitem' : 'menuitemradio');
	const press = (e: MouseEvent) => !disabled && onclick(e);
</script>

{#if href}
	<a
		{href}
		class={['item', 'follow', { selected, described: description }]}
		aria-label={description ? label : undefined}
		{role}
		aria-checked={checked ?? selected}
		aria-disabled={disabled || undefined}
		tabindex="-1"
		use:follow={press}
	>
		{@render content()}
	</a>
{:else}
	<button
		type="button"
		class={['item', { selected, described: description }]}
		aria-label={description ? label : undefined}
		{role}
		aria-checked={checked ?? selected}
		aria-disabled={disabled || undefined}
		tabindex="-1"
		onclick={press}
	>
		{@render content()}
	</button>
{/if}

{#snippet content()}
	{#if lead}
		{@render lead()}
	{:else if icon}
		<Icon name={icon} size={16} heavy class="glyph" />
	{:else if checked !== undefined || checkColumn}
		<span class="check">{#if checked}<Icon name="check" size={16} />{/if}</span>
	{/if}
	<span class="label">{label}{#if description}<span class="description">{description}</span>{/if}</span>
	{#if shortcut}<span class="shortcut">{shortcut}</span>{/if}
	{@render trailing?.()}
{/snippet}

<style>
	.item {
		display: flex;
		align-items: center;
		gap: var(--menu-icon-gap);
		height: var(--menu-item-height);
		padding: 0 var(--menu-item-padding);
		border-radius: var(--menu-item-radius);
		color: var(--ink);
		text-align: left;
		white-space: nowrap;
		outline: none;
	}

	.item :global(.glyph),
	.check {
		color: var(--ink-2);
	}

	.check {
		display: block;
		width: 16px;
		height: 16px;
		color: var(--ink);
	}

	.label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: pre;
	}

	.shortcut {
		margin-left: 24px;
		color: var(--ink-3);
	}

	.item:focus {
		background: var(--accent);
		color: var(--on-accent);
	}

	.item:focus :global(.glyph),
	.item:focus .shortcut,
	.item:focus .check {
		color: var(--on-accent);
	}

	.item:focus:active {
		background: linear-gradient(rgb(0 0 0 / 0.07), rgb(0 0 0 / 0.07)), var(--accent);
	}

	:global(.quiet) .item:focus {
		background: var(--fill);
		color: var(--ink);
	}

	:global(.quiet) .item:focus :global(.glyph) {
		color: var(--ink-2);
	}

	:global(.quiet) .item:focus .shortcut {
		color: var(--ink-3);
	}

	:global(.quiet) .item:focus:active {
		background: var(--fill-strong);
	}

	.item.selected,
	:global(.quiet) .item.selected:focus {
		background: var(--selection);
	}

	.item[aria-disabled='true'],
	.item[aria-disabled='true'] :global(.glyph),
	.item[aria-disabled='true'] .shortcut {
		color: var(--ink-3);
	}
	.described { height:auto; min-height:56px; padding-top:9px; padding-bottom:9px; align-items:flex-start; }
	.described :global(.glyph) { flex:none; margin-top:2px; }
	.described .label { white-space:normal; line-height:20px; }
	.description { display:block; margin-top:1px; font-size:12px; line-height:18px; color:var(--ink-3); font-weight:400; }
</style>
