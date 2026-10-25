<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Combobox from '#lib/components/Combobox.svelte';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let targets = $state<Record<string, string>>({});
	const existing = $derived(new Set(data.candidates.map((c) => c.value)));
	const kinds = Object.entries(t.maintenance.kinds);

	function href(kind: string, key = data.key) {
		const q = new URLSearchParams(kind === 'value' && key ? { kind, key } : { kind });
		return resolve(`/maintenance?${q}`);
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
					><span>{c.value}</span>
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
	p {
		margin: 0;
	}
</style>
