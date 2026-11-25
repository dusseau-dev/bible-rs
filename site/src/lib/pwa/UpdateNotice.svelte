<script lang="ts">
	import { pwa, updateApp } from './pwa.svelte';
	let dismissed = $state(false);
</script>

{#if pwa.waiting && !dismissed}
	<aside aria-label="App update" class="update">
		<p>A Bible update is ready. Finish editing before reloading.</p>
		<div><button type="button" onclick={updateApp} disabled={pwa.updating}>{pwa.updating ? 'Updating…' : 'Reload to update'}</button><button type="button" onclick={() => dismissed = true}>Later</button></div>
	</aside>
{/if}

<style>
	.update { position:fixed; z-index:200; left:max(16px,env(safe-area-inset-left)); right:max(16px,env(safe-area-inset-right)); bottom:max(16px,env(safe-area-inset-bottom)); max-width:430px; margin:auto; padding:16px; border:1px solid #a7b7ac; border-radius:16px; background:#fffdf7; color:#263442; box-shadow:0 8px 30px #0003; font:14px/1.5 system-ui,sans-serif; }
	p { margin:0 0 8px; }
	div { display:flex; flex-wrap:wrap; gap:8px; }
	.update button { min-height:44px; padding:8px 16px; border:0; border-radius:8px; background:#264c46; color:white; font:inherit; cursor:pointer; }
	button:active { opacity:.8; }
	button:focus-visible { outline:2px solid #396e61; outline-offset:3px; }
</style>
