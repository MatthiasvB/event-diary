<script lang="ts">
	import type { CropperCanvas, CropperSelection } from 'cropperjs';
	import { onMount } from 'svelte';
	import { on } from 'svelte/events';
	import { t } from '#lib/i18n.ts';
	import type { CropRequest } from '#lib/offerCrop.svelte.ts';
	import { cropOf, keptInside, type Box } from './crop.ts';

	let { request }: { request: CropRequest } = $props();

	let dialog: HTMLDialogElement;
	let canvas = $state<CropperCanvas>();
	let selection = $state<CropperSelection>();
	let open = $state(false);

	// The elements measure the canvas when they connect, so they come after the dialog shows.
	onMount(() => {
		dialog.showModal();
		open = true;
	});

	function sizeOf(element: Element) {
		const { width, height } = element.getBoundingClientRect();
		return { width, height };
	}

	function keepInside(e: Event) {
		if (!canvas || !selection) return;
		const inside = keptInside((e as CustomEvent<Box>).detail, selection, sizeOf(canvas));
		if (!inside) return;
		e.preventDefault();
		selection.$change(inside.x, inside.y, inside.width, inside.height);
	}

	function apply() {
		request.done(canvas && selection ? cropOf(selection, sizeOf(canvas)) : null);
	}
</script>

<dialog bind:this={dialog} aria-label={t.photos.cropTitle} oncancel={() => request.done(null)}>
	<div class="stage">
		{#if open}
			<cropper-canvas
				bind:this={canvas}
				style:width="min(100cqw, calc(100cqh * {request.width / request.height}))"
				style:aspect-ratio="{request.width} / {request.height}"
			>
				<cropper-image src={request.url} alt="" initial-center-size="contain"></cropper-image>
				<cropper-shade hidden></cropper-shade>
				<cropper-selection
					bind:this={selection}
					{@attach (s: CropperSelection) => on(s, 'change', keepInside)}
					initial-coverage="1"
					precise
					movable
					resizable
				>
					<cropper-grid role="grid" bordered covered></cropper-grid>
					<cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>
					{#each ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as side (side)}
						<cropper-handle action="{side}-resize" theme-color="#fff"></cropper-handle>
					{/each}
				</cropper-selection>
			</cropper-canvas>
		{/if}
	</div>
	<div class="bar">
		<button type="button" onclick={() => request.done(null)}>{t.photos.keepWhole}</button>
		<button type="button" class="primary" onclick={apply}>{t.photos.crop}</button>
	</div>
</dialog>

<style>
	dialog {
		width: 100vw;
		height: 100dvh;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		border: none;
		background: #000;
		color: #fff;
	}
	dialog::backdrop {
		background: #000;
	}
	dialog[open] {
		display: flex;
		flex-direction: column;
	}
	.stage {
		flex: 1;
		min-height: 0;
		margin: calc(1.5rem + env(safe-area-inset-top)) 1.5rem 1.5rem;
		container-type: size;
		display: grid;
		place-items: center;
	}
	/* Handles on the photo's edge reach past it, and fingers need room to grab them. */
	cropper-canvas {
		overflow: visible;
	}
	cropper-handle[action$='-resize'] {
		--grab: 44px;
		--shift: calc(8px - var(--grab) / 2);
	}
	cropper-handle:is([action='n-resize'], [action='s-resize']) {
		min-height: var(--grab);
		margin-block: var(--shift);
	}
	cropper-handle:is([action='e-resize'], [action='w-resize']) {
		min-width: var(--grab);
		margin-inline: var(--shift);
	}
	cropper-handle:is(
		[action='ne-resize'],
		[action='nw-resize'],
		[action='se-resize'],
		[action='sw-resize']
	) {
		min-width: var(--grab);
		min-height: var(--grab);
		margin: var(--shift);
		background: radial-gradient(circle, #fff 6px, rgb(0 0 0 / 0.4) 7px, transparent 8px);
	}
	.bar {
		position: relative;
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.6rem calc(0.6rem + env(safe-area-inset-right))
			calc(0.6rem + env(safe-area-inset-bottom)) calc(0.6rem + env(safe-area-inset-left));
	}
</style>
