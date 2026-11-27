<script lang="ts">
	import type { PageProps } from './$types';
	import InstallApp from '#lib/pwa/InstallApp.svelte';
	let { data }: PageProps = $props();
	const messages: Record<string, string> = { invalid: 'The email or password is incorrect.', limited: 'Too many sign-in attempts. Try again in 15 minutes.', unavailable: 'Sign-in is temporarily unavailable. Please try again later.' };
</script>

<svelte:head><title>Sign in · Bible</title><meta name="robots" content="noindex,nofollow" /></svelte:head>
<main>
	<form action="/auth/login" method="POST">
		<p class="eyebrow">YOUR PRIVATE READER</p>
		<h1>Welcome back.</h1>
		<p>Sign in to read and study.</p>
		{#if !data.configured}<p role="alert">Sign-in isn’t available yet. Finish account setup to continue.</p>{/if}
		{#if data.error}<p role="alert">{messages[data.error] ?? 'Unable to sign in. Please try again.'}</p>{/if}
		<label for="email">Email</label>
		<input id="email" name="email" type="email" autocomplete="username" autocapitalize="none" autocorrect="off" enterkeyhint="next" required maxlength="254" />
		<label for="password">Password</label>
		<input id="password" name="password" type="password" autocomplete="current-password" enterkeyhint="done" required maxlength="256" />
		<button disabled={!data.configured}>Sign in</button>
		<p class="hint">Private access only. There is no public signup.</p>
		<InstallApp />
	</form>
</main>
<style>
	main { min-height:100dvh; display:grid; place-items:center; background:#fffdf7; color:#263442; padding:max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left)); box-sizing:border-box; }
	form { width:100%; max-width:360px; font:16px/1.5 system-ui,sans-serif; }
	h1 { font:38px/1.15 Georgia,serif; margin:10px 0; }
	.eyebrow { color:#526e63; font-size:11px; letter-spacing:.16em; }
	label { display:block; margin:22px 0 6px; }
	input { width:100%; box-sizing:border-box; border:1px solid #b8b8ab; border-radius:8px; padding:12px; background:white; color:#263442; font:inherit; }
	button { width:100%; padding:13px; margin-top:24px; border:0; border-radius:8px; background:#264c46; color:white; font:inherit; cursor:pointer; }
	button:disabled { opacity:.5; cursor:default; }
	/* Immediate feedback on touch, without disabling pinch zoom or text selection. */
	button:active:not(:disabled) { opacity:.8; }
	.hint { font-size:13px; color:#596a70; }
	[role=alert] { color:#8a3027; }
	input:focus-visible,button:focus-visible { outline:2px solid #396e61; outline-offset:3px; }
</style>
