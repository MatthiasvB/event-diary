<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Combobox from '#lib/components/Combobox.svelte';
	import FieldsEditor from '#lib/components/FieldsEditor.svelte';
	import { t } from '#lib/i18n.ts';
	import { leaveFormOnRedirect } from '#lib/leaveForm.ts';
	import { entry, type FieldEntry } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const leave = leaveFormOnRedirect();

	// Field templates reuse the field editor: the value is the default.
	const start = untrack(() => $state.snapshot(data.type));
	let category = $state(start.category);
	let fields = $state<FieldEntry[]>(
		start.fields.map((f) => entry(f.target, f.key, f.default ?? ''))
	);
</script>

<svelte:head><title>{data.type.name} · {data.appName}</title></svelte:head>

<h1>{data.type.name}</h1>
<p class="muted small">{t.types.renameHint}</p>

<form method="POST" action="?/save" class="stack" use:enhance={() => leave}>
	<div>
		<label for="category">{t.events.category}</label>
		<Combobox id="category" bind:value={category} candidates={data.vocab.categories} />
		<input type="hidden" name="category" value={category} />
	</div>
	<label class="check"
		><input type="checkbox" name="milestone" checked={data.type.milestone} />
		{t.events.milestone}</label
	>
	<label>
		{t.types.hint}
		<textarea name="hint" rows="2">{data.type.hint}</textarea>
	</label>
	<fieldset>
		<legend>{t.types.fields}</legend>
		<p class="muted small">{t.types.fieldsHint}</p>
		<FieldsEditor bind:fields vocab={data.vocab} typeId={data.type.id} showTarget />
		{#each fields as f, i (i)}
			<input type="hidden" name="fieldKey" value={f.key} />
			<input type="hidden" name="fieldValue" value={f.value} />
			<input type="hidden" name="fieldTarget" value={f.target} />
			<input type="hidden" name="fieldKind" value={f.kind ? JSON.stringify(f.kind) : ''} />
		{/each}
	</fieldset>
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	<div class="sticky-actions"><button class="primary">{t.common.save}</button></div>
</form>

<form
	method="POST"
	action="?/delete"
	class="delete stack"
	use:enhance={({ cancel }) => {
		if (!confirm(t.types.confirmDelete(data.type.name, data.impact))) cancel();
		return leave;
	}}
>
	<p class="muted small">{t.types.deleteHint}</p>
	<div><button class="danger">{t.common.delete}</button></div>
</form>

<style>
	fieldset {
		border: none;
		margin: 0;
		padding: 0;
	}
	legend {
		padding: 0;
		color: var(--muted);
		font-size: 0.9rem;
	}
	fieldset p,
	h1 + p {
		margin: 0 0 0.5rem;
	}
	.delete {
		margin-top: 2.5rem;
	}
	.delete p {
		margin: 0;
	}
</style>
