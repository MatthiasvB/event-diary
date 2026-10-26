<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import TextInput from '#lib/components/TextInput.svelte';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let columns = $state(untrack(() => $state.snapshot(data.columns)));

	function move(i: number, step: number) {
		const next = [...columns];
		[next[i], next[i + step]] = [next[i + step], next[i]];
		columns = next;
	}

	function toggle(i: number, id: number, on: boolean) {
		const ids = columns[i].typeIds.filter((x) => x !== id);
		columns[i].typeIds = on ? [...ids, id] : ids;
	}
</script>

<svelte:head><title>{t.settings.title} · {data.appName}</title></svelte:head>

<h1>{t.settings.title}</h1>

<h2>{t.settings.overview}</h2>
<p class="muted small">{t.settings.overviewHint}</p>

<form
	method="POST"
	action="?/save"
	class="stack"
	use:enhance={() =>
		async ({ update }) =>
			update({ reset: false })}
>
	<input type="hidden" name="columns" value={JSON.stringify(columns)} />
	{#each columns as column, i (i)}
		<div class="card stack">
			<div class="row">
				<label class="grow">{t.settings.label} <TextInput bind:value={column.label} /></label>
				<button
					type="button"
					class="small"
					aria-label={t.settings.up}
					disabled={i === 0}
					onclick={() => move(i, -1)}>↑</button
				>
				<button
					type="button"
					class="small"
					aria-label={t.settings.down}
					disabled={i === columns.length - 1}
					onclick={() => move(i, 1)}>↓</button
				>
				<button
					type="button"
					class="small"
					aria-label={t.common.remove}
					onclick={() => (columns = columns.filter((_, j) => j !== i))}>×</button
				>
			</div>
			<details open={!column.typeIds.length}>
				<summary class="small">
					{t.settings.types}:
					{data.types
						.filter((ty) => column.typeIds.includes(ty.id))
						.map((ty) => ty.name)
						.join(', ') || '–'}
				</summary>
				<ul class="types">
					{#each data.types as ty (ty.id)}
						<li>
							<label class="check small">
								<input
									type="checkbox"
									checked={column.typeIds.includes(ty.id)}
									onchange={(e) => toggle(i, ty.id, e.currentTarget.checked)}
								/>
								{ty.name} <span class="muted">{ty.category}</span>
							</label>
						</li>
					{/each}
				</ul>
			</details>
		</div>
	{/each}
	<div>
		<button
			type="button"
			class="small"
			onclick={() => (columns = [...columns, { label: '', typeIds: [] }])}
			>+ {t.settings.addColumn}</button
		>
	</div>
	{#if form?.message}<p class="notice">{form.message}</p>{/if}
	<div class="sticky-actions"><button class="primary">{t.common.save}</button></div>
</form>

<style>
	.types {
		list-style: none;
		margin: 0.4rem 0 0;
		padding: 0;
		columns: 2 14rem;
	}
	summary {
		cursor: pointer;
	}
	p {
		margin: 0 0 0.5rem;
	}
</style>
