<script lang="ts">
	import { installApp, pwa } from './pwa.svelte';
</script>

{#if !pwa.installed}
	<div class="install">
		{#if pwa.prompt}<button type="button" onclick={() => void installApp()}>Install Bible</button>{/if}
		<details>
			<summary>Add Bible to your Home Screen</summary>
			<p>On iPhone, open this site in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>. Leave <b>Open as Web App</b> on if shown, then tap <b>Add</b>.</p>
			<p>In other browsers, choose <b>Install app</b> or <b>Add to Home Screen</b> from the browser menu.</p>
			<p>Sign in inside the app with your existing account. Reading and study require an internet connection. Notes and highlights are saved on this device; export a backup before switching browsers or devices.</p>
		</details>
		{#if pwa.error}<p role="status">{pwa.error}</p>{/if}
	</div>
{/if}

<style>
	.install { font:14px/1.6 system-ui,sans-serif; color:inherit; margin-top:16px; }
	summary { min-height:44px; display:list-item; align-content:center; cursor:pointer; touch-action:manipulation; }
	.install button { min-height:44px; padding:8px 16px; border:1px solid currentColor; border-radius:8px; color:inherit; background:transparent; font:inherit; cursor:pointer; }
	p { margin:10px 0; }
	button:active, summary:active { opacity:.7; }
	:focus-visible { outline:2px solid currentColor; outline-offset:3px; }
</style>
