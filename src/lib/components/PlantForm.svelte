<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import FieldsEditor from './FieldsEditor.svelte';
	import { t } from '#lib/i18n.ts';
	import type { Field, Vocabulary } from '#lib/types.ts';

	type Props = {
		plant: { id: string; name: string; active: boolean; acquiredOn: string | null; notes: string };
		attrs: { key: string; value: string }[];
		vocab: Pick<Vocabulary, 'keys' | 'values'>;
		isNew?: boolean;
		error?: string;
	};
	let { plant, attrs, vocab, isNew = false, error }: Props = $props();

	// Initial values only; the edit page re-creates the form with {#key}.
	let fields = $state<Field[]>(
		untrack(() => attrs.map((a) => ({ ...a, target: 'plant' as const })))
	);
</script>

<form
	method="POST"
	action="?/save"
	class="stack"
	use:enhance={() =>
		async ({ update }) =>
			update({ reset: false })}
>
	<div class="row">
		<label class="id">
			{t.plants.id}
			<input name="id" value={plant.id} required readonly={!isNew} autocapitalize="characters" />
		</label>
		<label class="grow">
			{t.plants.name}
			<input name="name" value={plant.name} required />
		</label>
	</div>
	<div class="row">
		<label class="grow">
			{t.plants.acquiredOn}
			<input name="acquiredOn" type="date" value={plant.acquiredOn ?? ''} />
		</label>
		<label class="check"
			><input name="active" type="checkbox" checked={plant.active} /> {t.plants.active}</label
		>
	</div>

	<fieldset>
		<legend>{t.plants.attributes}</legend>
		{#if !isNew}<p class="muted small">{t.plants.attributesHint}</p>{/if}
		<FieldsEditor bind:fields {vocab} defaultTarget="plant" addLabel={t.plants.addAttribute} />
		{#each fields as f, i (i)}
			<input type="hidden" name="attrKey" value={f.key} />
			<input type="hidden" name="attrValue" value={f.value} />
		{/each}
	</fieldset>

	<label>
		{t.plants.notes}
		<textarea name="notes" rows="3">{plant.notes}</textarea>
	</label>

	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<div class="sticky-actions"><button class="primary">{t.common.save}</button></div>
</form>

<style>
	.id {
		width: 9rem;
	}
	fieldset {
		border: none;
		margin: 0;
		padding: 0;
	}
	legend {
		padding: 0;
		margin-bottom: 0.4rem;
		color: var(--muted);
		font-size: 0.9rem;
	}
	fieldset p {
		margin: 0 0 0.5rem;
	}
</style>
