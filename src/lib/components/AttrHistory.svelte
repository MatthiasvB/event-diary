<script lang="ts">
	import { canEdit, diaryId } from '#lib/paths.ts';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import FieldValueInput from './FieldValueInput.svelte';
	import { showValue } from '#lib/fieldValues.ts';
	import { formatDate } from '#lib/format.ts';
	import { t } from '#lib/i18n.ts';
	import type { Candidate } from '#lib/suggest.ts';
	import type { ObjectAttr } from '#lib/types.ts';

	type Props = { key: string; history: ObjectAttr[]; candidates: Candidate[] };
	let { key, history, candidates }: Props = $props();

	let editing = $state(false);
	let draft = $state('');

	const initial = $derived(history.find((h) => !h.since && !h.eventId));
	const changed = $derived(history.length > 1);

	function edit() {
		draft = initial?.value ?? '';
		editing = true;
	}
</script>

<details open={editing || undefined}>
	<summary class="small">{t.objects.history} ({history.length})</summary>
	<ol class="small" reversed>
		{#each [...history].reverse() as h (h.id)}
			<li>
				<span class="muted">{h.since ? formatDate(h.since) : t.objects.initial}</span>
				{showValue(key, h.value)}
				{#if h.eventId}
					<a
						href={resolve('/[diary]/events/[id]/edit', { diary: diaryId(), id: String(h.eventId) })}
						>↗</a
					>
				{/if}
				{#if h === initial && changed && !editing && canEdit()}
					<button type="button" class="tiny" onclick={edit}>{t.objects.editInitial}</button>
					<form
						method="POST"
						action="?/forgetInitial"
						use:enhance={({ cancel }) => {
							if (!confirm(t.objects.confirmNotRecorded(key, showValue(key, h.value)))) cancel();
						}}
					>
						<input type="hidden" name="key" value={key} />
						<button class="tiny">{t.objects.notRecorded}</button>
					</form>
				{/if}
			</li>
		{/each}
	</ol>
	{#if !initial && !editing}
		<p class="muted small">
			{t.objects.beforeNotRecorded}
			{#if canEdit()}
				<button type="button" class="tiny" onclick={edit}>{t.objects.addInitial}</button>
			{/if}
		</p>
	{/if}
	{#if editing}
		<form
			method="POST"
			action="?/setInitial"
			class="stack edit"
			use:enhance={() =>
				async ({ update }) => {
					await update();
					editing = false;
				}}
		>
			<input type="hidden" name="key" value={key} />
			<input type="hidden" name="value" value={draft} />
			<FieldValueInput
				{key}
				bind:value={draft}
				{candidates}
				label={t.objects.initialValue}
				placeholder={t.objects.initialValue}
			/>
			<div class="row">
				<button class="small primary" disabled={!draft.trim()}>{t.common.save}</button>
				<button type="button" class="small" onclick={() => (editing = false)}
					>{t.common.cancel}</button
				>
			</div>
		</form>
	{/if}
</details>

<style>
	details {
		margin-top: 0.15rem;
	}
	summary {
		cursor: pointer;
		color: var(--accent);
	}
	ol {
		margin: 0.25rem 0 0;
		padding-left: 1.1rem;
	}
	p {
		margin: 0.15rem 0 0;
	}
	form {
		display: inline;
	}
	.tiny {
		min-height: 28px;
		margin-left: 0.3rem;
		padding: 0 0.5rem;
		font-size: 0.8rem;
	}
	form .tiny {
		margin-left: 0.2rem;
	}
	.edit {
		display: flex;
		margin-top: 0.4rem;
		gap: 0.4rem;
	}
</style>
