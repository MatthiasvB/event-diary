<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDate } from '#lib/format.ts';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const groups = $derived(
		Object.entries(Object.groupBy(data.types, (ty) => ty.category || t.types.noCategory)).sort(
			([a], [b]) => a.localeCompare(b, 'de')
		)
	);
</script>

<svelte:head><title>{t.types.title} · {data.appName}</title></svelte:head>

<h1>{t.types.title}</h1>
<p class="muted small">{t.types.renameHint}</p>

{#each groups as [category, types] (category)}
	<h2>{category}</h2>
	<ul class="stack list">
		{#each types ?? [] as ty (ty.id)}
			<li>
				<a class="card" href={resolve('/types/[id]', { id: String(ty.id) })}>
					<div class="spread">
						<strong
							>{ty.name}
							{#if ty.milestone}<span class="badge milestone">★</span>{/if}</strong
						>
						<span class="muted small">
							{ty.count ? `${t.types.count(ty.count)} · ${formatDate(ty.last)}` : t.types.unused}
						</span>
					</div>
					{#if ty.hint}<p class="muted small">{ty.hint}</p>{/if}
				</a>
			</li>
		{/each}
	</ul>
{/each}

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		gap: 0.4rem;
	}
	.list a {
		display: block;
		text-decoration: none;
		color: var(--text);
	}
	p {
		margin: 0.2rem 0 0;
	}
</style>
