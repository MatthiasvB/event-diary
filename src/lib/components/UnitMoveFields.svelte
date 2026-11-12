<script lang="ts">
	import ObjectValueInput from './ObjectValueInput.svelte';
	import { itemName } from '#lib/fieldValues.ts';
	import { t } from '#lib/i18n.ts';
	import { newRow, type MoveRow, type StockOption } from '#lib/unitMoves.ts';

	type Props = {
		move: MoveRow;
		stocks: StockOption[];
		chooseStock?: boolean;
		/** Set by the page: where the units go. */
		fixedTo?: number;
	};
	let { move = $bindable(), stocks, chooseStock = true, fixedTo }: Props = $props();

	const uid = $props.id();
	const stock = $derived(stocks.find((s) => s.id === move.stock));
	const holders = $derived(stock?.holders.filter((h) => h.id !== fixedTo) ?? []);

	function chooseStockId(id: number) {
		const fresh = newRow(stocks, { stock: id, to: fixedTo });
		move = { ...move, stock: fresh.stock, from: fresh.from };
	}
</script>

<div class="stack fields">
	{#if chooseStock}
		<label>
			{t.units.stockName}
			<select value={move.stock} onchange={(e) => chooseStockId(Number(e.currentTarget.value))}>
				{#each stocks as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
			</select>
		</label>
	{/if}

	<div class="stack tight">
		<label for="{uid}-quantity" class="muted small">{t.units.quantity}</label>
		<div class="row">
			<button
				type="button"
				aria-label={t.units.less}
				disabled={move.quantity <= 1}
				onclick={() => (move.quantity = move.quantity - 1)}>−</button
			>
			<input
				id="{uid}-quantity"
				class="quantity"
				type="number"
				min="1"
				inputmode="numeric"
				bind:value={move.quantity}
			/>
			<button
				type="button"
				aria-label={t.units.more}
				onclick={() => (move.quantity = move.quantity + 1)}>+</button
			>
		</div>
	</div>

	<div class="stack tight" role="group" aria-labelledby="{uid}-from">
		<span id="{uid}-from" class="muted small">{t.units.from}</span>
		<div class="row wrap">
			<button
				type="button"
				class="small"
				aria-pressed={move.from === null}
				disabled={move.to === null}
				onclick={() => (move.from = null)}>{t.units.added}</button
			>
			{#each holders as h (h.id)}
				<button
					type="button"
					class="small"
					aria-pressed={move.from === h.id}
					onclick={() => (move.from = h.id)}>{itemName(h.id)} · {h.count}</button
				>
			{/each}
		</div>
	</div>

	{#if fixedTo === undefined}
		<div class="stack tight">
			<span class="muted small">{t.units.to}</span>
			<div class="row">
				{#if move.to !== null}
					<div class="grow">
						<ObjectValueInput
							bind:value={() => move.to ?? '', (v) => (move.to = v)}
							candidates={[]}
							label={t.units.to}
						/>
					</div>
				{/if}
				<button
					type="button"
					class="small"
					aria-pressed={move.to === null}
					disabled={move.from === null}
					onclick={() => (move.to = move.to === null ? '' : null)}>{t.units.usedUp}</button
				>
			</div>
		</div>
	{/if}
</div>

<style>
	.fields {
		gap: 0.6rem;
	}
	.tight {
		gap: 0.3rem;
	}
	label.muted {
		display: block;
	}
	.wrap {
		flex-wrap: wrap;
	}
	.quantity {
		width: 5rem;
		text-align: center;
	}
	button[aria-pressed='true'] {
		background: var(--accent);
		color: var(--accent-text);
	}
</style>
