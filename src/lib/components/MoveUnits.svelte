<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import DateInput from './DateInput.svelte';
	import UnitMoveFields from './UnitMoveFields.svelte';
	import { today } from '#lib/format.ts';
	import { t } from '#lib/i18n.ts';
	import type { MoveRow } from '#lib/domain/unitLedger.ts';
	import type { StockOption } from '#lib/unitMoves.ts';

	type Props = {
		stocks: StockOption[];
		start: MoveRow;
		/** On a stock's page, the stock is given. */
		chooseStock: boolean;
		/** On a holder's page, where the units go is given. */
		fixedTo?: number;
		error?: string;
		onclose: () => void;
	};
	let { stocks, start, chooseStock, fixedTo, error, onclose }: Props = $props();

	let move = $state(untrack(() => $state.snapshot(start)));
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
	<UnitMoveFields bind:move {stocks} {chooseStock} {fixedTo} />
	<div class="stack tight">
		<DateInput bind:value={date} name="date" label={t.units.date} />
		<p class="muted small">{t.units.fromStart}</p>
	</div>
	<input type="hidden" name="move" value={JSON.stringify(move)} />
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
