<script lang="ts">
	import { page } from '$app/state';
	import Combobox from './Combobox.svelte';
	import { formatTarget, targetName } from '#lib/domain/associations.ts';
	import type { Candidate } from '#lib/suggest.ts';
	import { distinctLabels } from './objectLabels.ts';

	type Props = {
		value: string;
		/** How often each object is already the value, by the value as stored. */
		candidates: Candidate[];
		placeholder?: string;
		label?: string;
	};
	let { value = $bindable(''), candidates, placeholder, label }: Props = $props();

	const labels = $derived(
		distinctLabels((page.data.itemNames as Record<number, string> | undefined) ?? {})
	);
	const ids = $derived(new Map([...labels].map(([id, l]) => [l, id])));
	const used = $derived(new Map(candidates.map((c) => [c.value, c])));
	const options = $derived(
		[...labels].map(([id, l]) => {
			const c = used.get(formatTarget({ id }));
			return { value: l, count: c?.count ?? 0, last: c?.last ?? null };
		})
	);

	const valueOf = (text: string) => {
		const name = text.trim();
		const id = ids.get(name);
		if (id !== undefined) return formatTarget({ id });
		return name ? formatTarget({ name }) : '';
	};
	const textOf = (v: string) => targetName(v, (id) => labels.get(id)) ?? '';

	let text = $state(textOf(value));
	// Typing changes `value`. Only a change from outside, like a prefill, changes the text.
	$effect.pre(() => {
		if (valueOf(text) !== value) text = textOf(value);
	});
</script>

<Combobox
	bind:value={() => text, (v) => ((text = v), (value = valueOf(v)))}
	candidates={options}
	{placeholder}
	{label}
/>
