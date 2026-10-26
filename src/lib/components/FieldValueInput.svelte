<!--
	Input for a field value, by the kind of its name: a date, a number (with its unit) or
	plain text with suggestions (the default).
-->
<script lang="ts">
	import Combobox from './Combobox.svelte';
	import DateInput from './DateInput.svelte';
	import TextInput from './TextInput.svelte';
	import { fieldKind } from '#lib/fieldValues.ts';
	import type { FieldKind } from '#lib/fieldKinds.ts';
	import type { Candidate } from '#lib/suggest.ts';

	type Props = {
		key: string;
		value: string;
		candidates: Candidate[];
		placeholder?: string;
		label?: string;
		/** Instead of the stored kind of the name, e.g. one chosen for a new name. */
		kind?: FieldKind;
	};
	let { key, value = $bindable(''), candidates, placeholder, label, kind: given }: Props = $props();
	const kind = $derived(given ?? fieldKind(key));
</script>

{#if kind.kind === 'date'}
	<DateInput bind:value {label} />
{:else if kind.kind === 'number'}
	<div class="number">
		<div class="grow">
			<TextInput bind:value inputmode="decimal" {placeholder} aria-label={label} />
		</div>
		{#if kind.unit}<span class="unit">{kind.unit}</span>{/if}
	</div>
{:else}
	<Combobox bind:value {candidates} {placeholder} {label} />
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
