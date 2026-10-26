<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{t.invite.title} · {data.appName}</title></svelte:head>

<h1>{t.invite.title}</h1>
{#if !data.invite || form?.error}
	<p>{t.invite.invalid}</p>
	<p><a href={resolve('/')}>{t.more.switchDiary}</a></p>
{:else if data.member}
	<p>{t.invite.already}</p>
	<p>
		<a class="button primary" href={resolve('/[diary]', { diary: data.invite.diaryId })}
			>{t.invite.open}</a
		>
	</p>
{:else}
	<p>{t.invite.text(data.invite.by, data.invite.diaryName, t.diary.roles[data.invite.role])}</p>
	<form method="POST" use:enhance>
		<button class="primary">{t.invite.accept}</button>
	</form>
	{#if data.requiresLogin}
		<p class="muted small">{t.login.loggedInAs(data.user ?? '')}</p>
	{/if}
{/if}

<style>
	p,
	form {
		margin: 0 0 1rem;
	}
</style>
