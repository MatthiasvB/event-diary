<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '#lib/i18n.ts';
	import { leaveFormOnRedirect } from '#lib/leaveForm.ts';
	import type { PageProps } from './$types';

	let { form, data }: PageProps = $props();
	// The login page doesn't stay in the history either.
	const leave = leaveFormOnRedirect();
</script>

<svelte:head><title>{t.login.title} · {data.appName}</title></svelte:head>

<main class="login">
	<h1>{data.appName}</h1>
	<form method="POST" use:enhance={() => leave} class="stack">
		<label>
			{t.login.username}
			<input
				name="username"
				autocomplete="username"
				autocapitalize="none"
				required
				value={form?.username ?? ''}
			/>
		</label>
		<label>
			{t.login.password}
			<input name="password" type="password" autocomplete="current-password" required />
		</label>
		{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
		<button class="primary">{t.login.submit}</button>
	</form>
</main>

<style>
	.login {
		max-width: 22rem;
		margin: 15vh auto 0;
		padding: 0 1rem;
	}
</style>
