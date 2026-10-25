<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n.ts';
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
