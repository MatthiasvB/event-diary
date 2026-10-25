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
	};

	let {
		fields = $bindable(),
		vocab,
		typeId,
		showTarget = false,
		defaultTarget = 'event',
		current = {},
		addLabel = t.events.addField
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
					<label class="check small" title={t.events.targetPlantHint}>
						<input
							type="checkbox"
							checked={field.target === 'plant'}
							onchange={(e) => (field.target = e.currentTarget.checked ? 'plant' : 'event')}
						/>
						{t.events.targetPlant}
						{#if field.target === 'plant' && current[field.key]}
							<span class="muted">({t.events.currently(current[field.key])})</span>
						{/if}
					</label>
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
</style>
