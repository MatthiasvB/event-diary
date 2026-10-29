<!-- Generic key/value fields with suggestions for both keys and values. -->
<script lang="ts">
	import Combobox from './Combobox.svelte';
	import { page } from '$app/state';
	import FieldValueInput from './FieldValueInput.svelte';
	import TextInput from './TextInput.svelte';
	import { FIELD_KINDS, TEXT, type FieldKindName, type FieldKinds } from '#lib/fieldKinds.ts';
	import { showValue } from '#lib/fieldValues.ts';
	import { t } from '#lib/i18n.ts';
	import type { Candidate } from '#lib/suggest.ts';
	import type { Field, FieldTarget, ObjectAttr, Vocabulary } from '#lib/types.ts';

	type Props = {
		fields: Field[];
		vocab: Pick<Vocabulary, 'keys' | 'values'>;
		/** Event type for context-aware value suggestions. */
		typeId?: number;
		/**
		 * Event form and event types: fields can change the object. Property names always do;
		 * other names only when chosen (they become properties).
		 */
		showTarget?: boolean;
		defaultTarget?: FieldTarget;
		addLabel?: string;
		/**
		 * Event form with one object: its properties over time, to show what a change
		 * replaces and, for the first change of a property, to set the value before it.
		 */
		history?: Record<string, ObjectAttr[]>;
		/** Event form: the event's date, and its ID when editing. */
		date?: string;
		eventId?: number;
		/** Event form: choosing an event detail's name as property converts its past values. */
		convertsDetails?: boolean;
	};

	let {
		fields = $bindable(),
		vocab,
		typeId,
		showTarget = false,
		defaultTarget = 'event',
		addLabel = t.events.addField,
		history,
		date = '',
		eventId,
		convertsDetails = false
	}: Props = $props();

	// A name is either a property of objects or a detail of events.
	const properties = $derived(new Set(vocab.keys.object.map((k) => k.value)));
	const details = $derived(new Map(vocab.keys.event.map((k) => [k.value, k.count])));
	const isProperty = (key: string) => properties.has(key.trim());
	const changesObject = (f: Field) => isProperty(f.key) || f.target === 'object';

	// Both kinds of names are offered, marked; in the object form, details become properties.
	function keyCandidates(): Candidate[] {
		const used = new Set(fields.map((f) => f.key));
		const context = (k: (typeof vocab.keys.event)[number]) => (typeId ? k.byType[typeId] : 0);
		return [
			...vocab.keys.object.map((k) => ({
				...k,
				context: context(k),
				tag: showTarget ? { text: t.events.tagProperty, accent: true } : undefined
			})),
			...vocab.keys.event.map((k) => ({
				...k,
				context: context(k),
				tag: { text: t.events.tagDetail }
			}))
		].filter((k) => !used.has(k.value));
	}

	/**
	 * What a change of the property replaces: the last earlier change (then the value before
	 * is known), or else the initial value, which the first change may set.
	 */
	function before(f: Field) {
		// Editing: the event's own change doesn't count.
		const rows = (history?.[f.key.trim()] ?? []).filter((r) => !eventId || r.eventId !== eventId);
		const earlier = rows.filter((r) => r.since !== null && date && r.since <= date).at(-1);
		const initial = rows.find((r) => r.since === null && r.eventId === null);
		return { earlier, initial };
	}

	function valueCandidates(key: string): Candidate[] {
		return (vocab.values[key] ?? []).map((v) => ({ ...v, context: typeId ? v.byType[typeId] : 0 }));
	}

	type PreviousMode = 'keep' | 'unknown' | 'value';
	function previousMode(f: Field): PreviousMode {
		return f.previous === undefined ? 'keep' : f.previous === null ? 'unknown' : 'value';
	}
	function setPreviousMode(f: Field, mode: string) {
		if (mode === 'keep') delete f.previous;
		else f.previous = mode === 'unknown' ? null : '';
	}
	// No previous value set by a later change, which then wouldn't be the first one.
	$effect(() => {
		for (const f of fields) {
			if (f.previous !== undefined && (!changesObject(f) || !history || before(f).earlier)) {
				delete f.previous;
			}
		}
	});

	// A name used for the first time can get a kind (date, number) right here.
	const knownNames = $derived(
		new Set([...vocab.keys.event, ...vocab.keys.object].map((k) => k.value))
	);
	function isNewName(key: string) {
		const name = key.trim();
		const kinds = page.data.fieldKinds as FieldKinds | undefined;
		return !!name && !knownNames.has(name) && !kinds?.[name];
	}
	/** The kind chosen for a new name; otherwise the input uses the name's stored kind. */
	function chosenKind(f: Field) {
		return isNewName(f.key) ? (f.kind ?? TEXT) : undefined;
	}
	function setKind(f: Field, kind: string) {
		f.kind = { kind: kind as FieldKindName, unit: f.kind?.unit ?? '' };
	}

	function add() {
		fields = [...fields, { key: '', value: '', target: defaultTarget }];
	}
</script>

<div class="fields">
	{#each fields as field, i (i)}
		<div class="field">
			<div class="inputs">
				<Combobox
					bind:value={field.key}
					candidates={keyCandidates()}
					placeholder={t.events.fieldKey}
					label={t.events.fieldKey}
				/>
				<FieldValueInput
					key={field.key}
					kind={chosenKind(field)}
					bind:value={field.value}
					candidates={valueCandidates(field.key)}
					placeholder={t.events.fieldValue}
					label={field.key || t.events.fieldValue}
				/>
			</div>
			{#if isNewName(field.key)}
				<div class="row kind small">
					<label class="inline">
						{t.fieldKinds.kind}
						<select
							value={field.kind?.kind ?? 'text'}
							onchange={(e) => setKind(field, e.currentTarget.value)}
						>
							{#each FIELD_KINDS as k (k)}<option value={k}>{t.fieldKinds.names[k]}</option>{/each}
						</select>
					</label>
					{#if field.kind?.kind === 'number'}
						<label class="inline grow">
							{t.fieldKinds.unit}
							<TextInput
								bind:value={
									() => field.kind?.unit ?? '', (v) => (field.kind = { kind: 'number', unit: v })
								}
								placeholder={t.fieldKinds.unitPlaceholder}
							/>
						</label>
					{/if}
				</div>
			{/if}
			<div class="spread">
				{#if showTarget && field.key.trim()}
					{@const name = field.key.trim()}
					<div class="grow">
						{#if isProperty(name)}
							<p class="change small">
								<span class="badge property">↻ {t.events.changesProperty}</span>
							</p>
						{:else}
							<label class="check small" title={t.events.targetObjectHint}>
								<input
									type="checkbox"
									checked={field.target === 'object'}
									onchange={(e) => (field.target = e.currentTarget.checked ? 'object' : 'event')}
								/>
								<span>{t.events.targetObject}</span>
							</label>
							{#if field.target === 'object' && convertsDetails && details.has(name)}
								<p class="hint small">{t.events.becomesProperty(name, details.get(name) ?? 0)}</p>
							{/if}
						{/if}
						{#if changesObject(field) && history}
							{@const { earlier, initial } = before(field)}
							{#if earlier}
								<p class="small muted">{t.events.before(showValue(name, earlier.value))}</p>
							{:else}
								<label class="previous small" title={t.events.previousHint}>
									{t.events.previous}
									<select
										value={initial || typeof field.previous === 'string'
											? previousMode(field)
											: 'keep'}
										onchange={(e) => setPreviousMode(field, e.currentTarget.value)}
									>
										{#if initial}
											<option value="keep">{showValue(name, initial.value)}</option>
											<option value="unknown">{t.objects.notRecorded}</option>
											<option value="value">{t.events.previousOther}</option>
										{:else}
											<option value="keep">{t.objects.notRecorded}</option>
											<option value="value">{t.events.previousValue}</option>
										{/if}
									</select>
								</label>
								{#if typeof field.previous === 'string'}
									<FieldValueInput
										key={field.key}
										kind={chosenKind(field)}
										bind:value={() => field.previous ?? '', (v) => (field.previous = v)}
										candidates={valueCandidates(field.key)}
										placeholder={t.events.previousPlaceholder}
										label={t.events.previousPlaceholder}
									/>
								{/if}
							{/if}
						{/if}
					</div>
				{:else if !showTarget && details.has(field.key.trim())}
					<p class="hint small grow">
						{t.objects.fromEvents(field.key.trim(), details.get(field.key.trim()) ?? 0)}
					</p>
				{:else}
					<span></span>
				{/if}
				<button
					type="button"
					class="link small"
					onclick={() => (fields = fields.filter((_, j) => j !== i))}
				>
					{t.common.remove}
				</button>
			</div>
		</div>
	{/each}
	<div><button type="button" class="small" onclick={add}>+ {addLabel}</button></div>
</div>

<style>
	.kind {
		align-items: center;
		margin-top: 0.4rem;
	}
	.inline {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.inline select {
		width: auto;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.field {
		border-left: 3px solid var(--border);
		padding-left: 0.6rem;
	}
	.inputs {
		display: grid;
		grid-template-columns: 2fr 3fr;
		gap: 0.4rem;
	}
	label.check {
		min-height: 36px;
	}
	.previous {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0.2rem 0 0.3rem;
		color: var(--text);
	}
	.change {
		margin: 0.3rem 0 0;
	}
	.badge.property {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.hint {
		margin: 0.2rem 0;
	}
	.previous select {
		width: auto;
		min-height: 36px;
		padding: 0.25rem 0.5rem;
	}
</style>
