<script lang="ts">
	import { diaryId } from '#lib/paths.ts';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import DateInput from '#lib/components/DateInput.svelte';
	import EventCard from '#lib/components/EventCard.svelte';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const active = $derived(Object.values(data.filter).some(Boolean));

	function moreHref() {
		const url = new URL(page.url.href);
		url.searchParams.set('limit', String(data.limit + 100));
		url.searchParams.delete('saved');
		return resolve(`/[diary]/events${url.search}` as `/[diary]/events?${string}`, {
			diary: diaryId()
		});
	}
</script>

<svelte:head><title>{t.events.title} · {data.appName}</title></svelte:head>

<h1>{t.events.title}</h1>

{#if data.saved}<p class="notice">{t.events.saved(data.saved)}</p>{/if}

<details class="filters" open={active}>
	<summary>{t.common.filter}</summary>
	<form method="GET" class="stack">
		<select name="plant" value={data.filter.plantId} aria-label={t.events.allPlants}>
			<option value="">{t.events.allPlants}</option>
			{#each data.plants as p (p.id)}<option value={p.id}>{p.name} ({p.id})</option>{/each}
		</select>
		<div class="row">
			<select name="type" class="grow" value={data.filter.typeId} aria-label={t.events.allTypes}>
				<option value="">{t.events.allTypes}</option>
				{#each data.types as ty (ty.id)}<option value={String(ty.id)}>{ty.name}</option>{/each}
			</select>
			<select
				name="category"
				class="grow"
				value={data.filter.category}
				aria-label={t.events.allCategories}
			>
				<option value="">{t.events.allCategories}</option>
				{#each data.categories as c (c)}<option value={c}>{c}</option>{/each}
			</select>
		</div>
		<div class="row">
			<label class="grow">
				{t.events.from}
				<DateInput name="from" value={data.filter.from} />
			</label>
			<label class="grow">
				{t.events.to}
				<DateInput name="to" value={data.filter.to} />
			</label>
		</div>
		<div class="row">
			<button class="primary">{t.common.apply}</button>
			{#if active}<a class="button" href={resolve('/[diary]/events', { diary: diaryId() })}
					>{t.common.reset}</a
				>{/if}
		</div>
	</form>
</details>

<div class="stack list">
	{#each data.events as event (event.id)}
		<EventCard {event} showPlant />
	{:else}
		<p class="muted">{t.events.empty}</p>
	{/each}
</div>

{#if data.hasMore}
	<p><a class="button" href={moreHref()}>{t.events.more}</a></p>
{/if}

<style>
	.filters {
		margin-bottom: 1rem;
	}
	summary {
		cursor: pointer;
		padding: 0.5rem 0;
		color: var(--accent);
	}
	.list {
		gap: 0.6rem;
	}
</style>
