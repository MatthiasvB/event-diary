<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Combobox from './Combobox.svelte';
	import TextInput from './TextInput.svelte';
	import FieldsEditor from './FieldsEditor.svelte';
	import FileInput from './FileInput.svelte';
	import { t } from '#lib/i18n.ts';
	import { leaveFormOnRedirect } from '#lib/leaveForm.ts';
	import { uploadFiles, type Upload } from '#lib/upload.ts';
	import { entry, type FieldEntry, type Vocabulary } from '#lib/types.ts';

	type Props = {
		object: {
			name: string;
			active: boolean;
			listed: boolean;
			stock: { along: string } | null;
			notes: string;
		};
		attrs: { key: string; value: string }[];
		vocab: Pick<Vocabulary, 'keys' | 'values'>;
		/** The names of associations, which a stock's units can be spread along. */
		associations: string[];
		/** Units were moved, or other objects point to it. */
		stockLocked?: boolean;
		isNew?: boolean;
		error?: string;
	};
	let {
		object,
		attrs,
		vocab,
		associations,
		stockLocked = false,
		isNew = false,
		error
	}: Props = $props();
	const leave = leaveFormOnRedirect();

	// Pages re-create the form with {#key} when its initial values change.
	let fields = $state<FieldEntry[]>(
		untrack(() => attrs.map((a) => entry('object', a.key, a.value)))
	);
	let stock = $state(untrack(() => object.stock !== null));
	let along = $state(untrack(() => object.stock?.along ?? associations[0] ?? ''));
	let files = $state<Upload[]>([]);
	let photoDate = $state('');
	let uploaded = $state<number | null>(null);
	let uploadError = $state('');
</script>

<form
	method="POST"
	action="?/save"
	class="stack"
	use:enhance={async ({ formData, cancel }) => {
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
		{t.objects.name}
		<TextInput name="name" value={object.name} required />
	</label>
	{#if isNew}
		<div class="stack photo">
			<FileInput bind:files prominent onexifdate={(d) => (photoDate = d)} />
			<p class="muted small">{t.objects.photoHint}</p>
		</div>
	{/if}
	<label class="check"
		><input name="active" type="checkbox" checked={object.active} /> {t.objects.active}</label
	>
	<div class="stack listed">
		<label class="check"
			><input name="listed" type="checkbox" checked={object.listed} /> {t.objects.listed}</label
		>
		<p class="muted small">{t.objects.listedHint}</p>
	</div>
	<div class="stack listed">
		<label class="check"
			><input name="stock" type="checkbox" bind:checked={stock} disabled={stockLocked} />
			{t.units.stock}</label
		>
		{#if stockLocked && stock}<input type="hidden" name="stock" value="on" />{/if}
		<p class="muted small">{stockLocked ? t.units.locked : t.units.stockHint}</p>
		{#if stock}
			<label for="stock-along">{t.units.along}</label>
			<Combobox
				id="stock-along"
				bind:value={along}
				candidates={associations.map((value) => ({ value, count: 0, last: null }))}
				required
			/>
			<input type="hidden" name="stockAlong" value={along} />
		{/if}
	</div>

	<fieldset>
		<legend>{t.objects.attributes}</legend>
		{#if !isNew}<p class="muted small">{t.objects.attributesHint}</p>{/if}
		<FieldsEditor bind:fields {vocab} defaultTarget="object" addLabel={t.objects.addAttribute} />
		{#each fields as f, i (i)}
			<input type="hidden" name="attrKey" value={f.key} />
			<input type="hidden" name="attrValue" value={f.value} />
			<input type="hidden" name="attrChoice" value={f.chosen ? JSON.stringify(f.chosen) : ''} />
		{/each}
	</fieldset>

	<label>
		{t.objects.notes}
		<textarea name="notes" rows="3">{object.notes}</textarea>
	</label>

	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if uploadError}<p class="error" role="alert">{uploadError}</p>{/if}
	<div class="sticky-actions">
		<button class="primary" disabled={uploaded !== null}
			>{uploaded !== null && files.length
				? t.files.uploading(uploaded, files.length)
				: t.common.save}</button
		>
		{#if isNew}<button name="next" value="1">{t.objects.saveAndNext}</button>{/if}
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
	.listed {
		gap: 0.2rem;
	}
	.listed p {
		margin: 0;
	}
</style>
