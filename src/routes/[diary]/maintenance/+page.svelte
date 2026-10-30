<script lang="ts">
	import { diaryId } from '#lib/paths.ts';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Combobox from '#lib/components/Combobox.svelte';
	import TextInput from '#lib/components/TextInput.svelte';
	import { FIELD_KINDS, kindOf } from '#lib/fieldKinds.ts';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let targets = $state<Record<string, string>>({});
	const existing = $derived(new Set(data.candidates.map((c) => c.value)));
	const kinds = Object.entries(t.maintenance.kinds);

	let chosenKind = $state<Record<string, string>>({});
	const kindOfKey = (key: string) => kindOf(data.fieldKinds, key);

	function href(kind: string, key = data.key) {
		const q = new URLSearchParams(kind === 'value' && key ? { kind, key } : { kind });
		return resolve(`/[diary]/maintenance?${q}`, { diary: diaryId() });
	}
</script>

<svelte:head><title>{t.maintenance.title} · {data.appName}</title></svelte:head>

<h1>{t.maintenance.title}</h1>
<p class="muted small">{t.maintenance.intro}</p>

<nav class="row tabs">
	{#each kinds as [kind, label] (kind)}
		<a class="button small" class:primary={data.kind === kind} href={href(kind)}>{label}</a>
	{/each}
</nav>

{#if data.kind === 'value'}
	<label>
		{t.maintenance.chooseKey}
		<select value={data.key} onchange={(e) => goto(href('value', e.currentTarget.value))}>
			{#each data.keys as k (k)}<option value={k}>{k}</option>{/each}
		</select>
	</label>
{/if}

{#if form?.message}<p class="notice">{form.message}</p>{/if}

{#snippet renameForm(from: string, to: string, label: string, primary = false)}
	<form method="POST" action="?/rename" use:enhance>
		<input type="hidden" name="kind" value={data.kind} />
		<input type="hidden" name="key" value={data.key ?? ''} />
		<input type="hidden" name="from" value={from} />
		<input type="hidden" name="to" value={to} />
		<button class="small" class:primary disabled={!to.trim() || to === from}>{label}</button>
	</form>
{/snippet}

<h2>{t.maintenance.duplicates}</h2>
{#if data.duplicates.length}
	<ul class="stack list">
		{#each data.duplicates as d (d.from + '\0' + d.to)}
			<li class="card spread">
				<span
					>„{d.from}“ <span class="muted small">({t.maintenance.uses(d.fromCount)})</span> → „{d.to}“
					<span class="muted small">({t.maintenance.uses(d.toCount)})</span></span
				>
				{@render renameForm(d.from, d.to, t.maintenance.merge, true)}
			</li>
		{/each}
	</ul>
{:else}
	<p class="muted">{t.maintenance.noDuplicates}</p>
{/if}

<h2>{t.maintenance.kinds[data.kind as keyof typeof t.maintenance.kinds]}</h2>
<ul class="stack list">
	{#each data.candidates as c (c.value)}
		<li class="card">
			<details>
				<summary class="spread"
					><span
						>{c.value}
						{#if data.kind === 'key' && kindOfKey(c.value).kind !== 'text'}
							<span class="badge"
								>{t.fieldKinds.names[kindOfKey(c.value).kind]}{kindOfKey(c.value).unit
									? ` (${kindOfKey(c.value).unit})`
									: ''}</span
							>
						{/if}</span
					>
					<span class="muted small">{t.maintenance.uses(c.count)}</span></summary
				>
				<div class="stack rename">
					<Combobox
						bind:value={() => targets[c.value] ?? c.value, (v) => (targets[c.value] = v)}
						candidates={data.candidates.filter((o) => o.value !== c.value)}
						label={t.maintenance.renameTo}
					/>
					{#if targets[c.value] && targets[c.value] !== c.value && existing.has(targets[c.value].trim())}
						<p class="hint">{t.maintenance.willMerge(targets[c.value])}</p>
					{/if}
					<div>{@render renameForm(c.value, targets[c.value] ?? c.value, t.common.save)}</div>
				</div>
				{#if data.kind === 'key'}
					{@const kind = kindOfKey(c.value)}
					<form
						method="POST"
						action="?/setKind"
						class="row field-kind"
						use:enhance={() =>
							async ({ update }) =>
								update({ reset: false })}
					>
						<input type="hidden" name="key" value={c.value} />
						<label>
							{t.fieldKinds.kind}
							<select
								name="kind"
								value={kind.kind}
								onchange={(e) => (chosenKind[c.value] = e.currentTarget.value)}
							>
								{#each FIELD_KINDS as k (k)}<option value={k}>{t.fieldKinds.names[k]}</option
									>{/each}
							</select>
						</label>
						{#if (chosenKind[c.value] ?? kind.kind) === 'number'}
							<label class="grow">
								{t.fieldKinds.unit}
								<TextInput
									name="unit"
									value={kind.unit}
									placeholder={t.fieldKinds.unitPlaceholder}
								/>
							</label>
						{/if}
						<button class="small">{t.common.save}</button>
					</form>
				{/if}
			</details>
		</li>
	{/each}
</ul>

<style>
	.tabs {
		margin: 0.75rem 0;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		gap: 0.4rem;
	}
	summary {
		cursor: pointer;
	}
	.rename {
		margin-top: 0.6rem;
		gap: 0.5rem;
	}
	.field-kind {
		align-items: flex-end;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}
	p {
		margin: 0;
	}
</style>
