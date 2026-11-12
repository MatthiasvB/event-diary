<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import DateInput from './DateInput.svelte';
	import UnitMoveFields from './UnitMoveFields.svelte';
	import { today } from '#lib/format.ts';
	import { t } from '#lib/i18n.ts';
	import { newRow, type StockOption } from '#lib/unitMoves.ts';

	type Props = {
		stocks: StockOption[];
		/** Set by the page: the stock moved, or where its units go. */
		fixed: { stock: number } | { to: number };
		error?: string;
		onclose: () => void;
	};
	let { stocks, fixed, error, onclose }: Props = $props();

	let move = $state(untrack(() => newRow(stocks, fixed)));
	let date = $state(today());
</script>

<form
	method="POST"
	action="?/moveUnits"
	class="stack"
	use:enhance={() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') onclose();
		}}
>
	<UnitMoveFields
		bind:move
		{stocks}
		chooseStock={!('stock' in fixed)}
		fixedTo={'to' in fixed ? fixed.to : undefined}
	/>
	<div class="stack tight">
		<DateInput bind:value={date} name="date" label={t.units.date} />
		<p class="muted small">{t.units.fromStart}</p>
	</div>
	<input type="hidden" name="stock" value={move.stock ?? ''} />
	<input type="hidden" name="quantity" value={move.quantity} />
	<input type="hidden" name="from" value={move.from ?? ''} />
	<input type="hidden" name="to" value={move.to ?? ''} />
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<div class="row">
		<button class="primary">{t.common.save}</button>
		<button type="button" onclick={onclose}>{t.common.cancel}</button>
	</div>
</form>

<style>
	.tight {
		gap: 0.3rem;
	}
	p {
		margin: 0;
	}
</style>
