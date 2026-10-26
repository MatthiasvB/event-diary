<!--
	The main entry flow: object(s) → event type (prefills fields and shows its hint) →
	optional fields, note, photos and files → save. Used for new events, repeats and edits.
	New files are uploaded one by one when saving, then the event is saved with their IDs.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Combobox from './Combobox.svelte';
	import DateInput from './DateInput.svelte';
	import FieldsEditor from './FieldsEditor.svelte';
	import FileInput from './FileInput.svelte';
	import MediaThumb from './MediaThumb.svelte';
	import ObjectPicker from './ObjectPicker.svelte';
	import { formatDate, shiftDays, today } from '#lib/format.ts';
	import { t } from '#lib/i18n.ts';
	import { leaveFormOnRedirect } from '#lib/leaveForm.ts';
	import { isMedia, type EventFile } from '#lib/files.ts';
	import { uploadFiles } from '#lib/upload.ts';
	import type { EventType, Field, Vocabulary } from '#lib/types.ts';

	type ObjectOption = { id: number; name: string; active: boolean; attrs: Record<string, string> };
	export type EventFormInitial = {
		objectIds: number[];
		typeName: string;
		category: string;
		date: string;
		note: string;
		fields: Field[];
		/** Already attached (edit). */
		files: EventFile[];
	};

	type Props = {
		objects: ObjectOption[];
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
		objects,
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
		const ty = vocab.types.find((x) => x.name === s.typeName && x.category === s.category);
		// A preset type (photo mode) fills in its usual fields right away.
		const fields = !edit && !s.fields.length && ty ? proposeFields(ty, []) : s.fields;
		return { ...s, fields, typeId: ty?.id };
	});
	let objectIds = $state(start.objectIds);
	let typeName = $state(start.typeName);
	let date = $state(start.date);
	let note = $state(start.note);
	let fields = $state(start.fields);
	let keptFiles = $state(start.files);
	let category = $state(start.category);
	// A preset type (edit, repeat, photo) comes with its category.
	let categoryChosen = $state(!!start.typeName);
	let milestone = $state(false);
	let applyToBatch = $state(false);
	let exifDate = $state<string | null>(null);
	let dateTouched = false;
	let submitting = $state(false);
	let uploaded = $state<number | null>(null);
	let uploadError = $state('');

	// Several categories may have a type of the same name; name and category pick one.
	const named = $derived(vocab.types.filter((ty) => ty.name === typeName.trim()));
	const type = $derived(named.find((ty) => ty.category === category.trim()));
	const isNewType = $derived(typeName.trim() !== '' && !type);
	// The name exists in several categories and the user hasn't said which one.
	const mustChoose = $derived(named.length > 1 && !categoryChosen);
	// One suggestion per name, counting all its categories.
	const typeCandidates = $derived(
		Object.entries(Object.groupBy(vocab.types, (ty) => ty.name)).map(([value, types = []]) => ({
			value,
			count: types.reduce((n, ty) => n + ty.count, 0),
			last: types.reduce<string | null>(
				(l, ty) => (ty.last && (!l || ty.last > l) ? ty.last : l),
				null
			)
		}))
	);

	// Changing the type resets the category: a name in one category takes that one, a name
	// in several asks for one, a new or cleared name starts without.
	let lastName = start.typeName.trim();
	$effect(() => {
		const name = typeName.trim();
		if (name === lastName) return;
		lastName = name;
		const matches = vocab.types.filter((ty) => ty.name === name);
		category = matches.length === 1 ? matches[0].category : '';
		categoryChosen = matches.length < 2;
	});

	function chooseCategory(value: string) {
		category = value;
		categoryChosen = true;
	}

	// Typing counts as a choice; an emptied field doesn't (use the buttons for "none").
	function typeCategory(value: string) {
		category = value;
		categoryChosen = value.trim() !== '' || named.length < 2;
	}
	const current = $derived(
		objectIds.length === 1 ? (objects.find((p) => p.id === objectIds[0])?.attrs ?? {}) : {}
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
	class="stack"
	use:enhance={async ({ formData, cancel }) => {
		if (mustChoose) {
			cancel();
			document.getElementById('category')?.focus();
			return;
		}
		submitting = true;
		uploadError = '';
		let newFiles: string[];
		try {
			uploaded = 0;
			newFiles = await uploadFiles(files, (n) => (uploaded = n));
		} catch (e) {
			uploadError = (e as Error).message;
			submitting = false;
			cancel();
			return;
		} finally {
			uploaded = null;
		}
		formData.set(
			'payload',
			JSON.stringify({
				objectIds,
				typeName,
				category,
				milestone,
				date,
				note,
				fields,
				files: [...keptFiles.map((f) => f.id), ...newFiles],
				applyToBatch
			})
		);
		return async (submitted) => {
			await leave(submitted);
			submitting = false;
		};
	}}
>
	{#if photoMode}
		<FileInput bind:files onexifdate={onExifDate} documents />
	{/if}

	<div>
		<span class="label muted small">{t.events.objects}</span>
		<ObjectPicker {objects} bind:selected={objectIds} multiple={!edit} />
	</div>

	<div class="stack tight">
		<label for="type">{t.events.type}</label>
		<Combobox id="type" bind:value={typeName} candidates={typeCandidates} required />
	</div>

	<div class="stack tight">
		<label for="category">{t.events.category}</label>
		{#if named.length > 1}
			<p class="hint small">{t.events.chooseCategory(typeName.trim())}</p>
			<div class="row">
				{#each named as ty (ty.id)}
					<button
						type="button"
						class="small"
						aria-pressed={categoryChosen && category === ty.category}
						onclick={() => chooseCategory(ty.category)}>{ty.category || t.types.noCategory}</button
					>
				{/each}
			</div>
		{/if}
		<Combobox
			id="category"
			bind:value={() => category, typeCategory}
			candidates={vocab.categories}
		/>
		{#if type}
			{#if type.milestone}
				<p class="row small"><span class="badge milestone">★ {t.events.milestone}</span></p>
			{/if}
			{#if type.hint}<p class="hint">💡 {type.hint}</p>{/if}
		{:else if isNewType && !mustChoose}
			<div class="new-type stack tight">
				<strong class="small"
					>{t.events.newTypeIn(typeName.trim(), category.trim() || t.types.noCategory)}</strong
				>
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
			{#if keptFiles.length}
				<ul class="kept">
					{#each keptFiles as file (file.id)}
						<li title={file.name}>
							{#if isMedia({ type: file.mime, name: file.name })}
								<MediaThumb {file} />
							{:else}
								<span class="doc small">📄 {file.name}</span>
							{/if}
							<button
								type="button"
								class="small"
								aria-label="{t.events.removePhoto}: {file.name}"
								onclick={() => (keptFiles = keptFiles.filter((k) => k !== file))}>×</button
							>
						</li>
					{/each}
				</ul>
			{/if}
			<FileInput bind:files onexifdate={onExifDate} documents />
		</fieldset>
	{/if}

	{#if edit && batchSize > 1}
		<label class="check"
			><input type="checkbox" bind:checked={applyToBatch} />
			{t.events.applyToBatch(batchSize)}</label
		>
	{/if}

	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if uploadError}<p class="error" role="alert">{uploadError}</p>{/if}
	{#if mustChoose}<p class="error" role="alert">{t.events.categoryRequired}</p>{/if}

	<div class="sticky-actions">
		<button class="primary" disabled={submitting || mustChoose}
			>{uploaded !== null && files.length
				? t.files.uploading(uploaded, files.length)
				: t.common.save}</button
		>
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
	button[aria-pressed='true'] {
		background: var(--accent);
		color: var(--accent-text);
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
		width: 88px;
		height: 88px;
		border-radius: 8px;
		overflow: hidden;
		background: var(--surface-2);
	}
	.doc {
		display: block;
		padding: 0.4rem;
		overflow: hidden;
		overflow-wrap: anywhere;
		height: 100%;
	}
	.kept button {
		position: absolute;
		top: 2px;
		right: 2px;
		min-height: 0;
		padding: 0 0.45rem;
	}
</style>
