<!--
	The main entry flow: plant(s) → event type (prefills fields and shows its hint) →
	optional fields, note and photos → save. Used for new events, repeats and edits.
-->
<script lang="ts">
	import { photoUrl } from '#lib/paths.ts';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Combobox from './Combobox.svelte';
	import DateInput from './DateInput.svelte';
	import FieldsEditor from './FieldsEditor.svelte';
	import PhotoInput from './PhotoInput.svelte';
	import PlantPicker from './PlantPicker.svelte';
	import { formatDate, shiftDays, today } from '#lib/format.ts';
	import { t } from '#lib/i18n.ts';
	import { leaveFormOnRedirect } from '#lib/leaveForm.ts';
	import type { EventType, Field, Vocabulary } from '#lib/types.ts';

	type PlantOption = { id: string; name: string; active: boolean; attrs: Record<string, string> };
	export type EventFormInitial = {
		plantIds: string[];
		typeName: string;
		date: string;
		note: string;
		fields: Field[];
		keptPhotos: string[];
	};

	type Props = {
		plants: PlantOption[];
		vocab: Vocabulary;
		lastFields: Record<number, Field[]>;
		initial: EventFormInitial;
		files?: File[];
		edit?: boolean;
		batchSize?: number;
		photoMode?: boolean;
		error?: string;
	};

	let {
		plants,
		vocab,
		lastFields,
		initial,
		files = $bindable([]),
		edit = false,
		batchSize = 1,
		photoMode = false,
		error
	}: Props = $props();

	const leave = leaveFormOnRedirect();

	// The form owns its state from here on; the props are only the starting point
	// (pages re-create the form with {#key} when they change).
	const start = untrack(() => {
		const s = $state.snapshot(initial);
		const ty = vocab.types.find((x) => x.name === s.typeName);
		// A preset type (photo mode) fills in its usual fields right away.
		const fields = !edit && !s.fields.length && ty ? proposeFields(ty, []) : s.fields;
		return { ...s, fields, typeId: ty?.id };
	});
	let plantIds = $state(start.plantIds);
	let typeName = $state(start.typeName);
	let date = $state(start.date);
	let note = $state(start.note);
	let fields = $state(start.fields);
	let keptPhotos = $state(start.keptPhotos);
	let category = $state('');
	let milestone = $state(false);
	let applyToBatch = $state(false);
	let exifDate = $state<string | null>(null);
	let dateTouched = false;
	let submitting = $state(false);

	const type = $derived(vocab.types.find((ty) => ty.name === typeName.trim()));
	const isNewType = $derived(typeName.trim() !== '' && !type);
	const typeCandidates = $derived(
		vocab.types.map((ty) => ({ value: ty.name, count: ty.count, last: ty.last }))
	);
	const current = $derived(
		plantIds.length === 1 ? (plants.find((p) => p.id === plantIds[0])?.attrs ?? {}) : {}
	);

	// Choosing another type fills in its usual fields; values typed by the user win.
	let appliedTypeId = start.typeId;
	$effect(() => {
		if (type && type.id !== appliedTypeId) {
			appliedTypeId = type.id;
			fields = proposeFields(type, $state.snapshot(fields));
		}
	});

	function proposeFields(ty: EventType, own: Field[]): Field[] {
		const last = lastFields[ty.id] ?? [];
		const proposed = ty.fields.map((f) => {
			const mine = own.find((o) => o.key === f.key && o.value);
			const learned =
				f.target === 'event'
					? last.find((l) => l.key === f.key && l.target === f.target)?.value
					: '';
			return { key: f.key, target: f.target, value: mine?.value || f.default || learned || '' };
		});
		const extra = own.filter((o) => o.key && o.value && !proposed.some((p) => p.key === o.key));
		return [...proposed, ...extra];
	}

	function onExifDate(d: string) {
		exifDate = d;
		if (photoMode && !dateTouched) date = d;
	}

	function setDate(d: string) {
		date = d;
		dateTouched = true;
	}
</script>

<form
	method="POST"
	action="?/save"
	enctype="multipart/form-data"
	class="stack"
	use:enhance={({ formData }) => {
		submitting = true;
		formData.set(
			'payload',
			JSON.stringify({
				plantIds,
				typeName,
				category,
				milestone,
				date,
				note,
				fields,
				keptPhotos,
				applyToBatch
			})
		);
		for (const f of files) formData.append('photos', f);
		return async (submitted) => {
			await leave(submitted);
			submitting = false;
		};
	}}
>
	{#if photoMode}
		<PhotoInput bind:files onexifdate={onExifDate} />
	{/if}

	<div>
		<span class="label muted small">{t.events.plants}</span>
		<PlantPicker {plants} bind:selected={plantIds} multiple={!edit} />
	</div>

	<div class="stack tight">
		<label for="type">{t.events.type}</label>
		<Combobox id="type" bind:value={typeName} candidates={typeCandidates} required />
		{#if type}
			<p class="row small">
				{#if type.category}<span class="badge">{type.category}</span>{/if}
				{#if type.milestone}<span class="badge milestone">★ {t.events.milestone}</span>{/if}
			</p>
			{#if type.hint}<p class="hint">💡 {type.hint}</p>{/if}
		{:else if isNewType}
			<div class="new-type stack tight">
				<strong class="small">{t.events.newType}</strong>
				<label for="category">{t.events.category}</label>
				<Combobox id="category" bind:value={category} candidates={vocab.categories} />
				<label class="check"
					><input type="checkbox" bind:checked={milestone} /> {t.events.milestone}</label
				>
			</div>
		{/if}
	</div>

	<div class="stack tight">
		<label for="date">{t.events.date}</label>
		<div class="row">
			<div class="grow">
				<DateInput id="date" bind:value={date} required onchange={() => (dateTouched = true)} />
			</div>
			<button type="button" class="small" onclick={() => setDate(today())}>{t.date.today}</button>
			<button type="button" class="small" onclick={() => setDate(shiftDays(today(), -1))}
				>{t.date.yesterday}</button
			>
		</div>
		{#if exifDate && exifDate !== date}
			<div>
				<button type="button" class="small" onclick={() => setDate(exifDate!)}
					>{t.events.exifDate(formatDate(exifDate))}</button
				>
			</div>
		{/if}
	</div>

	<fieldset>
		<legend>{t.events.fields}</legend>
		<FieldsEditor bind:fields {vocab} typeId={type?.id} showTarget showPrevious {current} />
	</fieldset>

	<label>
		{t.events.note}
		<textarea bind:value={note} rows="3"></textarea>
	</label>

	{#if !photoMode}
		<fieldset>
			<legend>{t.events.photos}</legend>
			{#if keptPhotos.length}
				<ul class="kept">
					{#each keptPhotos as id (id)}
						<li>
							<img src={photoUrl(id, 's')} alt="" />
							<button
								type="button"
								class="small"
								aria-label={t.events.removePhoto}
								onclick={() => (keptPhotos = keptPhotos.filter((k) => k !== id))}>×</button
							>
						</li>
					{/each}
				</ul>
			{/if}
			<PhotoInput bind:files onexifdate={onExifDate} />
		</fieldset>
	{/if}

	{#if edit && batchSize > 1}
		<label class="check"
			><input type="checkbox" bind:checked={applyToBatch} />
			{t.events.applyToBatch(batchSize)}</label
		>
	{/if}

	{#if error}<p class="error" role="alert">{error}</p>{/if}

	<div class="sticky-actions">
		<button class="primary" disabled={submitting}>{t.common.save}</button>
	</div>
</form>

<style>
	.tight {
		gap: 0.3rem;
	}
	.label {
		display: block;
		margin-bottom: 0.3rem;
	}
	p.row {
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
	.new-type {
		padding: 0.6rem;
		border-radius: 10px;
		background: var(--surface-2);
	}
	.kept {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		list-style: none;
		margin: 0 0 0.5rem;
		padding: 0;
	}
	.kept li {
		position: relative;
	}
	.kept img {
		width: 88px;
		height: 88px;
		object-fit: cover;
		border-radius: 8px;
	}
	.kept button {
		position: absolute;
		top: 2px;
		right: 2px;
		min-height: 0;
		padding: 0 0.45rem;
	}
</style>
