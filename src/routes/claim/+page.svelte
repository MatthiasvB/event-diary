<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let owner = $state<'me' | 'other'>('me');
</script>

<svelte:head><title>{t.claim.title} · {data.appName}</title></svelte:head>

<h1>{t.claim.title}</h1>
<p>{t.claim.intro(data.diaryName)}</p>

<form method="POST" class="stack" use:enhance>
	<label class="check">
		<input type="radio" name="owner" value="me" bind:group={owner} />
		{t.claim.me(data.user ?? '')}
	</label>
	<label class="check">
		<input type="radio" name="owner" value="other" bind:group={owner} />
		{t.claim.other}
	</label>
	{#if owner === 'other'}
		<input name="other" required autocapitalize="none" aria-label={t.login.username} />
	{/if}
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	<div><button class="primary">{t.claim.submit}</button></div>
</form>

<form method="POST" action="/logout" class="logout">
	<button class="small">{t.login.logout}</button>
</form>

<style>
	p {
		margin: 0 0 1rem;
	}
	.logout {
		margin-top: 2rem;
	}
</style>
