<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n.ts';
	import { shortcutLabel, shortcuts } from '#lib/shortcuts.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{t.more.title} · {data.appName}</title></svelte:head>

<h1>{t.more.title}</h1>
<nav class="stack menu">
	<a class="card" href={resolve('/types')}>{t.types.title}</a>
	<a class="card" href={resolve('/maintenance')}>{t.maintenance.title}</a>
	<a class="card" href={resolve('/settings')}>{t.settings.title}</a>
</nav>

<section class="desktop-only">
	<h2>{t.shortcuts.title}</h2>
	<dl class="attrs">
		{#each shortcuts as s (s.key)}
			<dt><kbd>{shortcutLabel(s.key)}</kbd></dt>
			<dd>{s.label}</dd>
		{/each}
	</dl>
	<p class="muted small">{t.shortcuts.hint}</p>
</section>

{#if data.requiresLogin}
	<form method="POST" action="/logout" class="logout stack">
		<p class="muted small">{t.login.loggedInAs(data.user ?? '')}</p>
		<div><button>{t.login.logout}</button></div>
	</form>
{/if}

<style>
	.menu {
		gap: 0.5rem;
	}
	kbd {
		padding: 0.05rem 0.4rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		font: inherit;
		font-size: 0.9rem;
	}
	section p {
		margin: 0.5rem 0 0;
	}
	.menu a {
		text-decoration: none;
		color: var(--text);
		font-weight: 500;
	}
	.logout {
		margin-top: 2rem;
		gap: 0.4rem;
	}
	p {
		margin: 0;
	}
</style>
