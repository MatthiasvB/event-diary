<script lang="ts">
	import { canEdit, diaryId, photoUrl } from '#lib/paths.ts';
	import { resolve } from '$app/paths';
	import { formatDate, relativeDays } from '#lib/format.ts';
	import { dropFiles } from '#lib/dropFiles.ts';
	import { isMedia } from '#lib/files.ts';
	import TextInput from '#lib/components/TextInput.svelte';
	import { t } from '#lib/i18n.ts';
	import { showValue } from '#lib/fieldValues.ts';
	import { openPhotoEvent } from '#lib/pending.svelte.ts';
	import { normalize } from '#lib/suggest.ts';
	import type { Snapshot } from './$types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type ActiveFilter = 'active' | 'inactive' | 'all';
	let query = $state('');
	let active = $state<ActiveFilter>('active');
	let attrFilters = $state<{ key: string; value: string }[]>([]);
	let newKey = $state('');

	// Keep filters when navigating back from a plant, but not the search: it was for
	// finding that one plant.
	export const snapshot: Snapshot<{
		active: ActiveFilter;
		attrFilters: typeof attrFilters;
	}> = {
		capture: () => ({ active, attrFilters: $state.snapshot(attrFilters) }),
		restore: (s) => ({ active, attrFilters } = s)
	};

	const keys = $derived([...new Set(data.plants.flatMap((p) => Object.keys(p.attrs)))].sort());
	const valuesOf = (key: string) =>
		[...new Set(data.plants.map((p) => p.attrs[key]).filter(Boolean))].sort((a, b) =>
			a.localeCompare(b, 'de')
		);

	const shown = $derived.by(() => {
		const q = normalize(query);
		return data.plants.filter(
			(p) =>
				(active === 'all' || p.active === (active === 'active')) &&
				attrFilters.every((f) => !f.value || p.attrs[f.key] === f.value) &&
				(!q || normalize([p.name, p.id, p.notes, ...Object.values(p.attrs)].join(' ')).includes(q))
		);
	});

	const summary = ({ count, last }: (typeof data.plants)[number]['stats']) =>
		[
			t.plants.events(count),
			last && `${t.plants.lastEvent}: ${last.type}, ${relativeDays(last.date)}`
		]
			.filter(Boolean)
			.join(' · ');

	function addFilter() {
		if (newKey) attrFilters = [...attrFilters, { key: newKey, value: '' }];
		newKey = '';
	}
</script>

<svelte:head><title>{t.plants.title} · {data.appName}</title></svelte:head>

<div class="spread">
	<h1>{t.plants.title}</h1>
	{#if canEdit()}
		<a class="button small" href={resolve('/[diary]/plants/new', { diary: diaryId() })}
			>+ {t.plants.new}</a
		>
	{/if}
</div>

<!-- Stays visible while scrolling, so you can search from anywhere in the list. -->
<div class="search">
	<TextInput
		type="search"
		bind:value={query}
		placeholder={t.plants.searchPlaceholder}
		aria-label={t.common.search}
	/>
</div>
<div class="stack filters">
	<div class="row">
		<div class="segmented" role="group" aria-label={t.plants.active}>
			{#each Object.entries(t.plants.activeFilter) as [value, label] (value)}
				<button
					type="button"
					aria-pressed={active === value}
					onclick={() => (active = value as ActiveFilter)}>{label}</button
				>
			{/each}
		</div>
		{#if keys.length}
			<select class="grow" bind:value={newKey} onchange={addFilter} aria-label={t.plants.addFilter}>
				<option value="">{t.plants.addFilter}</option>
				{#each keys as k (k)}<option value={k}>{k}</option>{/each}
			</select>
		{/if}
	</div>
	{#each attrFilters as f, i (i)}
		<div class="row">
			<span class="muted">{f.key}</span>
			<select class="grow" bind:value={f.value} aria-label={f.key}>
				<option value="">{t.common.all}</option>
				{#each valuesOf(f.key) as v (v)}<option value={v}>{showValue(f.key, v)}</option>{/each}
			</select>
			<button
				type="button"
				class="small"
				aria-label={t.common.remove}
				onclick={() => (attrFilters = attrFilters.filter((_, j) => j !== i))}>×</button
			>
		</div>
	{/each}
</div>

<ul class="grid">
	{#each shown as p (p.id)}
		<li>
			<a
				class="card plant"
				href={resolve('/[diary]/plants/[id]', { diary: diaryId(), id: p.id })}
				{@attach canEdit() && dropFiles((files) => openPhotoEvent(files, p.id), isMedia)}
			>
				{#if p.coverPhotoId}
					<img src={photoUrl(p.coverPhotoId, 's')} alt="" loading="lazy" />
				{:else}
					<div class="placeholder" aria-hidden="true">🌱</div>
				{/if}
				<div class="body">
					<strong>{p.name}</strong>
					{#if !p.active}<span class="badge">{t.plants.inactive}</span>{/if}
					<dl class="small">
						{#each data.columns as label, i (label)}
							{@const date = p.stats.columns[i]}
							{#if date}
								<dt>{label}</dt>
								<dd title={formatDate(date)}>{relativeDays(date)}</dd>
							{/if}
						{/each}
					</dl>
					<p class="muted small">{summary(p.stats)}</p>
				</div>
			</a>
		</li>
	{:else}
		<li class="muted">{t.plants.empty}</li>
	{/each}
</ul>

<style>
	.search {
		position: sticky;
		top: var(--sticky-top);
		z-index: 4;
		margin: 0 -1rem;
		padding: 0.5rem 1rem;
		background: var(--bg);
	}
	.filters {
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.segmented {
		display: inline-flex;
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: hidden;
	}
	.segmented button {
		border: none;
		border-radius: 0;
	}
	.segmented button[aria-pressed='true'] {
		background: var(--accent);
		color: var(--accent-text);
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
		gap: 0.6rem;
	}
	.plant {
		display: flex;
		gap: 0.75rem;
		padding: 0.6rem;
		color: inherit;
		text-decoration: none;
		height: 100%;
	}
	.plant img,
	.placeholder {
		width: 76px;
		height: 76px;
		flex: none;
		object-fit: cover;
		border-radius: 8px;
		background: var(--surface-2);
	}
	.placeholder {
		display: grid;
		place-items: center;
		font-size: 2rem;
	}
	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	dl {
		display: grid;
		/* Long labels wrap; the short dates ("vor 225 Tagen") stay on one line. */
		grid-template-columns: minmax(0, max-content) 1fr;
		gap: 0 0.6rem;
		margin: 0;
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		white-space: nowrap;
	}
	p {
		margin: 0;
	}
</style>
