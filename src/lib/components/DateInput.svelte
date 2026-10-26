<!--
	A date typed as digits, year first, formatted to YYYY-MM-DD while typing.
	The browser's calendar only opens from the separate calendar button.
-->
<script lang="ts">
	import { formatTypedDate, isValidDate } from '#lib/format.ts';
	import { t } from '#lib/i18n.ts';

	type Props = {
		value: string;
		id?: string;
		name?: string;
		required?: boolean;
		label?: string;
		/** Show a button that empties the field. */
		clearable?: boolean;
		/** Called with each complete, valid date (typed or picked). */
		onchange?: (date: string) => void;
	};

	let {
		value = $bindable(''),
		id,
		name,
		required,
		label,
		clearable = true,
		onchange
	}: Props = $props();

	let field: HTMLInputElement;
	let picker: HTMLInputElement;
	let blurred = $state(false);

	const invalid = $derived(value !== '' && (value.length === 10 || blurred) && !isValidDate(value));

	// Blocks form submission with a message while the text isn't a valid date.
	$effect(() => {
		field.setCustomValidity(value && !isValidDate(value) ? t.date.invalid : '');
	});

	function oninput() {
		value = formatTypedDate(field.value);
		field.value = value; // also when the state didn't change, e.g. a letter was typed
		blurred = false;
		if (isValidDate(value)) onchange?.(value);
	}

	function openPicker() {
		picker.value = isValidDate(value) ? value : '';
		try {
			picker.showPicker();
		} catch {
			picker.focus();
			picker.click();
		}
	}

	function picked() {
		if (!picker.value) return;
		value = picker.value;
		onchange?.(value);
	}
</script>

<div class="date-input">
	<input
		bind:this={field}
		{id}
		{name}
		{required}
		{value}
		type="text"
		inputmode="numeric"
		autocomplete="off"
		maxlength="10"
		placeholder={t.date.placeholder}
		aria-label={label}
		aria-invalid={invalid}
		{oninput}
		onblur={() => (blurred = true)}
	/>
	{#if clearable && value}
		<button
			type="button"
			class="clear"
			aria-label={t.date.clear}
			onclick={() => {
				value = '';
				field.focus();
			}}>×</button
		>
	{/if}
	<button type="button" class="calendar" aria-label={t.date.openCalendar} onclick={openPicker}>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<rect x="3.5" y="5" width="17" height="15" rx="2" />
			<path d="M3.5 10h17M8 3v4M16 3v4" />
		</svg>
	</button>
	<input
		bind:this={picker}
		type="date"
		class="picker"
		tabindex="-1"
		aria-hidden="true"
		onchange={picked}
	/>
</div>

<style>
	.date-input {
		position: relative;
		display: flex;
		gap: 0.35rem;
	}
	.date-input > input[type='text'] {
		flex: 1;
		min-width: 0;
		font-variant-numeric: tabular-nums;
		padding-right: 2.4rem;
	}
	.clear {
		position: absolute;
		right: calc(44px + 0.35rem + 2px);
		top: 50%;
		transform: translateY(-50%);
		min-height: 0;
		width: 36px;
		height: 36px;
		padding: 0;
		border: none;
		background: none;
		color: var(--muted);
		font-size: 1.4rem;
	}
	.calendar {
		flex: none;
		width: 44px;
		padding: 0;
	}
	.calendar svg {
		width: 22px;
		height: 22px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
	}
	/* Present for showPicker(), but invisible; the calendar opens next to the button. */
	.date-input > .picker {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 44px;
		min-height: 0;
		height: 1px;
		padding: 0;
		border: 0;
		opacity: 0;
		pointer-events: none;
	}
</style>
