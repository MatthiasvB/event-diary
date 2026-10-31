<script lang="ts">
	import Combobox from './Combobox.svelte';
	import DateInput from './DateInput.svelte';
	import TextInput from './TextInput.svelte';
	import { fieldKind, suggestsValues } from '#lib/fieldValues.ts';
	import type { FieldKind } from '#lib/fieldKinds.ts';
	import type { Candidate } from '#lib/suggest.ts';

	type Props = {
		key: string;
		value: string;
		candidates: Candidate[];
		placeholder?: string;
		label?: string;
		/** Instead of what is stored for the name, e.g. what is chosen for a new name. */
		kind?: FieldKind;
		suggest?: boolean;
	};
	let {
		key,
		value = $bindable(''),
		candidates,
		placeholder,
		label,
		kind: givenKind,
		suggest: givenSuggest
	}: Props = $props();
	const kind = $derived(givenKind ?? fieldKind(key));
	const suggest = $derived(givenSuggest ?? suggestsValues(key));
</script>

{#if kind.kind === 'date'}
	<DateInput bind:value {label} />
{:else if kind.kind === 'number'}
	<div class="number">
		<div class="grow">
			<TextInput bind:value inputmode="decimal" {placeholder} aria-label={label} />
		</div>
		{#if kind.kind === 'number' && kind.unit}<span class="unit">{kind.unit}</span>{/if}
	</div>
{:else if suggest}
	<Combobox bind:value {candidates} {placeholder} {label} />
{:else}
	<TextInput bind:value {placeholder} aria-label={label} />
{/if}

<style>
	.number {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
	.unit {
		color: var(--muted);
	}
</style>
