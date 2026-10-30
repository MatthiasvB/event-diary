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
	let input: HTMLInputElement;
	let open = $state(false);
	let active = $state(-1);
	// The list opens above the field when there is room, so it doesn't cover the next field.
	let up = $state(false);
	let maxHeight = $state(256);

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
		...suggestions.map((s) => ({ value: s.value, tag: s.tag, isNew: false })),
		...(isNew ? [{ value: trimmed, tag: undefined, isNew: true }] : [])
	]);

	function show() {
		if (open) return;
		const viewport = window.visualViewport;
		const top = viewport?.offsetTop ?? 0;
		const bottom = top + (viewport?.height ?? window.innerHeight);
		const rect = input.getBoundingClientRect();
		const above = rect.top - top;
		const below = bottom - rect.bottom;
		up = above >= 180 || above > below;
		maxHeight = Math.max(120, Math.min(256, (up ? above : below) - 8));
		open = true;
	}

	function choose(v: string) {
		value = v;
		open = false;
		active = -1;
		onselect?.(v);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			show();
			// Opened upwards, the list is reversed: the best match is next to the field.
			const towardsMatches = up ? 'ArrowUp' : 'ArrowDown';
			const step = e.key === towardsMatches ? 1 : -1;
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
	<div class="has-clear">
		<input
			bind:this={input}
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
			onfocus={show}
			onblur={() => {
				open = false;
				if (exists) onselect?.(trimmed);
			}}
			oninput={() => {
				show();
				active = -1;
			}}
			{onkeydown}
		/>
		{#if value}
			<button
				type="button"
				class="input-clear"
				aria-label={t.common.clear}
				onmousedown={(e) => e.preventDefault()}
				onclick={() => {
					value = '';
					input.focus();
					show();
				}}>×</button
			>
		{/if}
	</div>
	{#if open && options.length}
		<ul id={listId} role="listbox" class:up style:max-height="{maxHeight}px">
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
					{#if option.tag}<span class="tag" class:accent={option.tag.accent}>{option.tag.text}</span
						>{/if}
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
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0.25rem 0;
		list-style: none;
		overflow-y: auto;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.15);
	}
	ul.up {
		top: auto;
		bottom: calc(100% + 2px);
		flex-direction: column-reverse;
		box-shadow: 0 -8px 24px rgb(0 0 0 / 0.15);
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
	li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.tag {
		margin-left: auto;
		padding: 0 0.45rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--muted);
		font-size: 0.75rem;
		white-space: nowrap;
	}
	.tag.accent {
		background: var(--accent-soft);
		color: var(--accent);
	}
	li.new {
		color: var(--accent);
		font-weight: 600;
		border-top: 1px solid var(--border);
	}
	ul.up li.new {
		border-top: none;
		border-bottom: 1px solid var(--border);
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
