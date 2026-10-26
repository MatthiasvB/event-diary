<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import TextInput from './TextInput.svelte';
	import FieldsEditor from './FieldsEditor.svelte';
	import FileInput from './FileInput.svelte';
	import { t } from '#lib/i18n.ts';
	import { leaveFormOnRedirect } from '#lib/leaveForm.ts';
	import { uploadFiles } from '#lib/upload.ts';
	import type { Field, Vocabulary } from '#lib/types.ts';

	type Props = {
		plant: { name: string; active: boolean; notes: string };
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
	let uploaded = $state<number | null>(null);
	let uploadError = $state('');
</script>

<form
	method="POST"
	action="?/save"
	class="stack"
	use:enhance={async ({ formData, cancel }) => {
		// Photos are uploaded one by one first; the plant is saved with their IDs.
		uploadError = '';
		try {
			uploaded = 0;
			const ids = await uploadFiles(files, (n) => (uploaded = n));
			for (const id of ids) formData.append('file', id);
		} catch (e) {
			uploadError = (e as Error).message;
			cancel();
			return;
		} finally {
			uploaded = null;
		}
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
			<FileInput bind:files prominent onexifdate={(d) => (photoDate = d)} />
			<p class="muted small">{t.plants.photoHint}</p>
		</div>
	{/if}
	<label class="check"
		><input name="active" type="checkbox" checked={plant.active} /> {t.plants.active}</label
	>

	<fieldset>
		<legend>{t.plants.attributes}</legend>
		{#if !isNew}<p class="muted small">{t.plants.attributesHint}</p>{/if}
		<FieldsEditor bind:fields {vocab} defaultTarget="plant" addLabel={t.plants.addAttribute} />
		{#each fields as f, i (i)}
			<input type="hidden" name="attrKey" value={f.key} />
			<input type="hidden" name="attrValue" value={f.value} />
			<input type="hidden" name="attrKind" value={f.kind ? JSON.stringify(f.kind) : ''} />
		{/each}
	</fieldset>

	<label>
		{t.plants.notes}
		<textarea name="notes" rows="3">{plant.notes}</textarea>
	</label>

	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if uploadError}<p class="error" role="alert">{uploadError}</p>{/if}
	<div class="sticky-actions">
		<button class="primary" disabled={uploaded !== null}
			>{uploaded !== null && files.length
				? t.files.uploading(uploaded, files.length)
				: t.common.save}</button
		>
		{#if isNew}<button name="next" value="1">{t.plants.saveAndNext}</button>{/if}
	</div>
</form>

<style>
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
