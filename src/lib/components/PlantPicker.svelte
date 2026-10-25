<!-- Choose one or many plants: search, pick individually, or select all matching a filter. -->
<script lang="ts">
	import { t } from '#lib/i18n.ts';
	import { normalize } from '#lib/suggest.ts';

	type PlantOption = { id: string; name: string; active: boolean; attrs: Record<string, string> };
	type Props = { plants: PlantOption[]; selected: string[]; multiple?: boolean };

	let { plants, selected = $bindable(), multiple = true }: Props = $props();

	let query = $state('');
	let onlyActive = $state(true);
	let filterKey = $state('');
	let filterValue = $state('');
	// Collapsed once something is chosen, so the form stays short on a phone.
	let expanded = $state(selected.length === 0);

	const byId = $derived(new Map(plants.map((p) => [p.id, p])));
	const keys = $derived([...new Set(plants.flatMap((p) => Object.keys(p.attrs)))].sort());
	const filterValues = $derived(
		filterKey
			? [...new Set(plants.map((p) => p.attrs[filterKey]).filter(Boolean))].sort((a, b) =>
					a.localeCompare(b, 'de')
				)
			: []
	);

	const matching = $derived.by(() => {
		const q = normalize(query);
		return plants.filter(
			(p) =>
				(!onlyActive || p.active) &&
				(!filterKey || !filterValue || p.attrs[filterKey] === filterValue) &&
				(!q || normalize(`${p.name} ${p.id} ${Object.values(p.attrs).join(' ')}`).includes(q))
		);
	});

	function toggle(id: string) {
		if (!multiple) {
			selected = [id];
			expanded = false;
			return;
		}
		selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
	}

	function selectAll() {
		selected = [...new Set([...selected, ...matching.map((p) => p.id)])];
	}
</script>

<div class="picker">
	<div class="chips">
		{#each selected as id (id)}
			<span class="chip">
				{byId.get(id)?.name ?? id} <span class="muted small">{id}</span>
				{#if multiple}
					<button
						type="button"
						class="link"
						aria-label="{t.common.remove}: {byId.get(id)?.name}"
						onclick={() => toggle(id)}>×</button
					>
				{/if}
			</span>
		{/each}
		<button
			type="button"
			class="small"
			aria-expanded={expanded}
			onclick={() => (expanded = !expanded)}
		>
			{selected.length ? t.common.edit : t.events.choosePlants}
		</button>
	</div>

	{#if expanded}
		<div class="panel stack">
			<input
				type="search"
				bind:value={query}
				placeholder={t.plants.searchPlaceholder}
				aria-label={t.common.search}
			/>
			<div class="row">
				<label class="check small"
					><input type="checkbox" bind:checked={onlyActive} /> {t.events.onlyActive}</label
				>
				{#if multiple && keys.length}
					<select
						class="grow"
						bind:value={filterKey}
						aria-label={t.plants.addFilter}
						onchange={() => (filterValue = '')}
					>
						<option value="">{t.plants.addFilter}</option>
						{#each keys as k (k)}<option value={k}>{k}</option>{/each}
					</select>
					{#if filterKey}
						<select class="grow" bind:value={filterValue} aria-label={filterKey}>
							<option value="">{t.common.all}</option>
							{#each filterValues as v (v)}<option value={v}>{v}</option>{/each}
						</select>
					{/if}
				{/if}
			</div>
			{#if multiple}
				<div class="row">
					<button type="button" class="small" onclick={selectAll} disabled={!matching.length}>
						{t.events.selectAllMatching(matching.length)}
					</button>
					{#if selected.length}
						<button type="button" class="small" onclick={() => (selected = [])}
							>{t.events.clearSelection}</button
						>
					{/if}
				</div>
			{/if}
			<ul>
				{#each matching as p (p.id)}
					<li>
						<label class="check">
							<input
								type={multiple ? 'checkbox' : 'radio'}
								checked={selected.includes(p.id)}
								onchange={() => toggle(p.id)}
							/>
							<span class="grow">{p.name}</span>
						</label>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.3rem 0.2rem 0.7rem;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--text);
	}
	.chip .link {
		font-size: 1.2rem;
		line-height: 1;
		padding: 0 0.35rem;
	}
	.panel {
		margin-top: 0.5rem;
		padding: 0.6rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface-2);
		gap: 0.5rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 18rem;
		overflow-y: auto;
	}
	li + li {
		border-top: 1px solid var(--border);
	}
</style>
