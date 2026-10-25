<!--
	Text input with ranked suggestions from existing values. Anything typed is accepted;
	a value that doesn't exist yet is marked as new, and close existing values are offered.
-->
<script lang="ts">
	import { t } from '#lib/i18n.ts';
	import { findSimilar, rank, type Candidate } from '#lib/suggest.ts';

	type Props = {
		value: string;
		candidates: Candidate[];
		id?: string;
		placeholder?: string;
		required?: boolean;
		label?: string;
		onselect?: (value: string) => void;
	};

	let {
		value = $bindable(''),
		candidates,
		id,
		placeholder,
		required,
		label,
		onselect
	}: Props = $props();

	const uid = $props.id();
	const listId = `${uid}-list`;
	let open = $state(false);
	let active = $state(-1);

	const trimmed = $derived(value.trim());
	const suggestions = $derived(rank(value, candidates, { limit: 8 }));
	const exists = $derived(candidates.some((c) => c.value === trimmed));
	const isNew = $derived(trimmed !== '' && !exists);
	const similar = $derived(
		isNew
			? findSimilar(
					trimmed,
					candidates.map((c) => c.value)
				).slice(0, 3)
			: []
	);
	const options = $derived([
		...suggestions.map((s) => ({ value: s.value, isNew: false })),
		...(isNew ? [{ value: trimmed, isNew: true }] : [])
	]);

	function choose(v: string) {
		value = v;
		open = false;
		active = -1;
		onselect?.(v);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			open = true;
			const step = e.key === 'ArrowDown' ? 1 : -1;
			active = (active + step + options.length) % options.length;
		} else if (e.key === 'Enter' && open && active >= 0 && options[active]) {
			e.preventDefault();
			choose(options[active].value);
		} else if (e.key === 'Escape' && open) {
			e.preventDefault();
			open = false;
		}
	}
</script>

<div class="combobox">
	<input
		{id}
		{placeholder}
		{required}
		bind:value
		role="combobox"
		autocomplete="off"
		aria-label={label}
		aria-expanded={open && options.length > 0}
		aria-controls={listId}
		aria-autocomplete="list"
		aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
		onfocus={() => (open = true)}
		onblur={() => {
			open = false;
			if (exists) onselect?.(trimmed);
		}}
		oninput={() => {
			open = true;
			active = -1;
		}}
		{onkeydown}
	/>
	{#if open && options.length}
		<ul id={listId} role="listbox">
			{#each options as option, i (option.isNew ? '\0new' : option.value)}
				<!-- Keyboard selection is handled on the input (combobox pattern). -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<li
					id="{listId}-{i}"
					role="option"
					aria-selected={i === active}
					class:new={option.isNew}
					onmousedown={(e) => e.preventDefault()}
					onclick={() => choose(option.value)}
				>
					{option.isNew ? t.combobox.create(option.value) : option.value}
				</li>
			{/each}
		</ul>
	{/if}
	{#if similar.length && !open}
		<p class="similar">
			{t.combobox.similar}
			{#each similar as s (s)}
				<button type="button" class="small" onclick={() => choose(s)}>{s}</button>
			{/each}
		</p>
	{/if}
</div>

<style>
	.combobox {
		position: relative;
	}
	ul {
		position: absolute;
		z-index: 20;
		left: 0;
		right: 0;
		top: calc(100% + 2px);
		margin: 0;
		padding: 0.25rem 0;
		list-style: none;
		max-height: 16rem;
		overflow-y: auto;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.15);
	}
	li {
		padding: 0.6rem 0.75rem;
		cursor: pointer;
		color: var(--text);
	}
	li[aria-selected='true'],
	li:hover {
		background: var(--accent-soft);
	}
	li.new {
		color: var(--accent);
		font-weight: 600;
		border-top: 1px solid var(--border);
	}
	.similar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		margin: 0.35rem 0 0;
		padding: 0.4rem 0.6rem;
		background: var(--warn-soft);
		border-radius: 10px;
		font-size: 0.875rem;
		color: var(--text);
	}
</style>
