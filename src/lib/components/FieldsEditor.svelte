<!-- Generic key/value fields with suggestions for both keys and values. -->
<script lang="ts">
	import Combobox from './Combobox.svelte';
	import { t } from '#lib/i18n.ts';
	import type { Candidate } from '#lib/suggest.ts';
	import type { Field, FieldTarget, Vocabulary } from '#lib/types.ts';

	type Props = {
		fields: Field[];
		vocab: Pick<Vocabulary, 'keys' | 'values'>;
		/** Event type for context-aware value suggestions. */
		typeId?: number;
		/** Allow choosing whether a field is stored on the plant (event form only). */
		showTarget?: boolean;
		defaultTarget?: FieldTarget;
		/** Current plant attribute values, shown next to fields that change the plant. */
		current?: Record<string, string>;
		addLabel?: string;
		/** Offer setting the value before the change for plant fields (event form only). */
		showPrevious?: boolean;
	};

	let {
		fields = $bindable(),
		vocab,
		typeId,
		showTarget = false,
		defaultTarget = 'event',
		current = {},
		addLabel = t.events.addField,
		showPrevious = false
	}: Props = $props();

	function keyCandidates(target: FieldTarget): Candidate[] {
		const used = new Set(fields.map((f) => f.key));
		return vocab.keys[target]
			.filter((k) => !used.has(k.value))
			.map((k) => ({ ...k, context: typeId ? k.byType[typeId] : 0 }));
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
					candidates={keyCandidates(field.target)}
					placeholder={t.events.fieldKey}
					label={t.events.fieldKey}
				/>
				<Combobox
					bind:value={field.value}
					candidates={valueCandidates(field.key)}
					placeholder={field.target === 'plant' && current[field.key]
						? t.events.currently(current[field.key])
						: t.events.fieldValue}
					label={field.key || t.events.fieldValue}
				/>
			</div>
			<div class="spread">
				{#if showTarget}
					<div class="grow">
						<label class="check small" title={t.events.targetPlantHint}>
							<input
								type="checkbox"
								checked={field.target === 'plant'}
								onchange={(e) => (field.target = e.currentTarget.checked ? 'plant' : 'event')}
							/>
							<span>
								{t.events.targetPlant}
								{#if field.target === 'plant' && current[field.key]}
									<span class="muted">({t.events.currently(current[field.key])})</span>
								{/if}
							</span>
						</label>
						{#if field.target === 'plant' && showPrevious}
							<label class="previous small" title={t.events.previousHint}>
								{t.events.previous}
								<select
									value={previousMode(field)}
									onchange={(e) => setPreviousMode(field, e.currentTarget.value)}
								>
									<option value="keep">{t.events.previousKeep}</option>
									<option value="unknown">{t.plants.notRecorded}</option>
									<option value="value">{t.events.previousValue}</option>
								</select>
							</label>
							{#if typeof field.previous === 'string'}
								<Combobox
									bind:value={() => field.previous ?? '', (v) => (field.previous = v)}
									candidates={valueCandidates(field.key)}
									placeholder={t.events.previousPlaceholder}
									label={t.events.previousPlaceholder}
								/>
							{/if}
						{/if}
					</div>
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
	.previous select {
		width: auto;
		min-height: 36px;
		padding: 0.25rem 0.5rem;
	}
</style>
