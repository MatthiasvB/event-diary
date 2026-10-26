<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import DateInput from './DateInput.svelte';
	import TextInput from './TextInput.svelte';
	import FieldsEditor from './FieldsEditor.svelte';
	import PhotoInput from './PhotoInput.svelte';
	import { t } from '#lib/i18n.ts';
	import { leaveFormOnRedirect } from '#lib/leaveForm.ts';
	import type { Field, Vocabulary } from '#lib/types.ts';

	type Props = {
		plant: { name: string; active: boolean; acquiredOn: string | null; notes: string };
		attrs: { key: string; value: string }[];
		vocab: Pick<Vocabulary, 'keys' | 'values'>;
		isNew?: boolean;
		error?: string;
	};
	let { plant, attrs, vocab, isNew = false, error }: Props = $props();
	const leave = leaveFormOnRedirect();

	// Initial values only; the pages re-create the form with {#key}.
	let fields = $state<Field[]>(
		untrack(() => attrs.map((a) => ({ ...a, target: 'plant' as const })))
	);
	// New plants only: first photos, saved as a photo event.
	let files = $state<File[]>([]);
	let photoDate = $state('');
</script>

<form
	method="POST"
	action="?/save"
	enctype="multipart/form-data"
	class="stack"
	use:enhance={({ formData }) => {
		for (const f of files) formData.append('photos', f);
		formData.set('photoDate', photoDate);
		return leave;
	}}
>
	<label>
		{t.plants.name}
		<TextInput name="name" value={plant.name} required />
	</label>
	{#if isNew}
		<div class="stack photo">
			<PhotoInput bind:files prominent onexifdate={(d) => (photoDate = d)} />
			<p class="muted small">{t.plants.photoHint}</p>
		</div>
	{/if}
	<div class="row bottom">
		<label class="grow">
			{t.plants.acquiredOn}
			<DateInput name="acquiredOn" value={plant.acquiredOn ?? ''} />
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
	<div class="sticky-actions">
		<button class="primary">{t.common.save}</button>
		{#if isNew}<button name="next" value="1">{t.plants.saveAndNext}</button>{/if}
	</div>
</form>

<style>
	/* Align the checkbox with the input, not with its label. */
	.bottom {
		align-items: flex-end;
	}
	.photo {
		gap: 0.3rem;
	}
	.photo p {
		margin: 0;
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
