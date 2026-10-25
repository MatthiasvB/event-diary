<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	function open(id: string) {
		const diary = resolve('/[diary]', { diary: id });
		return data.then ? `${diary}/${data.then}` : diary;
	}
</script>

<svelte:head><title>{t.diaries.title} · {data.appName}</title></svelte:head>

<h1>{t.diaries.title}</h1>
{#if data.then}<p class="notice">{t.diaries.shareHint}</p>{/if}

{#if data.diaries.length}
	<ul class="stack list">
		{#each data.diaries as diary (diary.id)}
			<li>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve() -->
				<a class="card" href={open(diary.id)}>
					<strong>{diary.name}</strong>
					<span class="muted small">{t.diaries.types[diary.type]}</span>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<p class="muted">{t.diaries.empty}</p>
{/if}

<h2>{t.diaries.new}</h2>
<form method="POST" action="?/create" class="stack" use:enhance>
	<label>
		{t.diaries.name}
		<input name="name" required value={data.diaries.length ? '' : data.appName} />
	</label>
	<label>
		{t.diaries.type}
		<select name="type">
			{#each data.types as type (type)}<option value={type}>{t.diaries.types[type]}</option>{/each}
		</select>
	</label>
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	<div><button class="primary">{t.diaries.create}</button></div>
</form>

{#if data.requiresLogin}
	<form method="POST" action="/logout" class="logout">
		<span class="muted small">{t.login.loggedInAs(data.user ?? '')}</span>
		<button class="small">{t.login.logout}</button>
	</form>
{/if}

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		gap: 0.5rem;
	}
	.list a {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
		text-decoration: none;
		color: var(--text);
	}
	.logout {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 2rem;
	}
</style>
