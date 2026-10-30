<script lang="ts">
	import { diaryId } from '#lib/paths.ts';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { formatDate } from '#lib/format.ts';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const groups = $derived(
		[...Map.groupBy(data.types, (ty) => ty.category)].sort(([a], [b]) =>
			(a ?? t.types.noCategory).localeCompare(b ?? t.types.noCategory, 'de')
		)
	);
</script>

<svelte:head><title>{t.types.title} · {data.appName}</title></svelte:head>

<h1>{t.types.title}</h1>
<p class="muted small">{t.types.renameHint}</p>

{#each groups as [category, types = []] (category)}
	<div class="spread heading">
		<h2>{category ?? t.types.noCategory}</h2>
		{#if category}
			<form
				method="POST"
				action="?/deleteCategory"
				use:enhance={({ cancel }) => {
					const impact = data.impacts[category];
					if (!confirm(t.types.confirmDeleteCategory(category, types.length, impact))) cancel();
				}}
			>
				<input type="hidden" name="category" value={category} />
				<button class="danger small">{t.types.deleteCategory}</button>
			</form>
		{/if}
	</div>
	<ul class="stack list">
		{#each types as ty (ty.id)}
			<li>
				<a
					class="card"
					href={resolve('/[diary]/types/[id]', { diary: diaryId(), id: String(ty.id) })}
				>
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
	.heading {
		align-items: baseline;
	}
</style>
