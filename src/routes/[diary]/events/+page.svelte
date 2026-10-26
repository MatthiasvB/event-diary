<script lang="ts">
	import { diaryId } from '#lib/paths.ts';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import DateInput from '#lib/components/DateInput.svelte';
	import TextInput from '#lib/components/TextInput.svelte';
	import EventCard from '#lib/components/EventCard.svelte';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const active = $derived(Object.values(data.filter).some(Boolean));

	// Searches while typing (shortly after the last key), keeping the other filters.
	let form = $state<HTMLFormElement>();
	let timer: ReturnType<typeof setTimeout> | undefined;
	function searchSoon() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (!form) return;
			const params = new URLSearchParams(
				[...new FormData(form)].filter(([, v]) => v).map(([k, v]) => [k, String(v)])
			);
			// No reset: the cursor stays in the search field and the list where it is.
			goto(resolve(`/[diary]/events?${params}`, { diary: diaryId() }), {
				reset: false,
				replace: true
			});
		}, 300);
	}

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

<form method="GET" class="stack" bind:this={form}>
	<!-- Stays visible while scrolling, like the object search. -->
	<div class="search">
		<TextInput
			type="search"
			name="q"
			value={data.search}
			placeholder={t.events.searchPlaceholder}
			aria-label={t.common.search}
			oninput={searchSoon}
		/>
	</div>
	<details class="filters" open={active}>
		<summary>{t.common.filter}</summary>
		<div class="stack">
			<select name="plant" value={data.filter.plantId} aria-label={t.events.allPlants}>
				<option value="">{t.events.allPlants}</option>
				{#each data.plants as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
			</select>
			<div class="row">
				<select name="type" class="grow" value={data.filter.typeId} aria-label={t.events.allTypes}>
					<option value="">{t.events.allTypes}</option>
					{#each data.types as ty (ty.id)}
						<option value={String(ty.id)}>{ty.name}{ty.category ? ` (${ty.category})` : ''}</option>
					{/each}
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
		</div>
	</details>
</form>

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
	.search {
		position: sticky;
		top: var(--sticky-top);
		z-index: 4;
		margin: 0 -1rem;
		padding: 0.5rem 1rem;
		background: var(--bg);
	}
	form {
		gap: 0;
	}
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
