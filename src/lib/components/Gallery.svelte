<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import MediaThumb from './MediaThumb.svelte';
	import PhotoViewer, { type ViewerPhoto } from './PhotoViewer.svelte';
	import { fileKind } from '#lib/files.ts';
	import { t } from '#lib/i18n.ts';

	type Props = {
		photos: ViewerPhoto[];
		coverPhotoId?: string | null;
		/** Posts to the page's `?/cover` action. */
		canSetCover?: boolean;
	};

	let { photos, coverPhotoId = null, canSetCover = false }: Props = $props();

	const PREVIEW = 9;
	let showAll = $state(false);
	let viewer: PhotoViewer;

	const visible = $derived(showAll ? photos : photos.slice(0, PREVIEW));

	const LONG_PRESS_MS = 500;
	let coverForm = $state<HTMLFormElement>();
	let pressedId = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;
	let start = { x: 0, y: 0 };
	let longPressed = false;

	function pressStart(e: PointerEvent, p: ViewerPhoto) {
		longPressed = false;
		if (!canSetCover || e.button !== 0 || fileKind(p.mime, p.name) !== 'image') return;
		const id = p.id;
		start = { x: e.clientX, y: e.clientY };
		timer = setTimeout(async () => {
			timer = undefined;
			longPressed = true;
			navigator.vibrate?.(30);
			pressedId = id;
			await tick();
			coverForm?.requestSubmit();
		}, LONG_PRESS_MS);
	}

	function pressEnd() {
		clearTimeout(timer);
		timer = undefined;
	}

	function pressMove(e: PointerEvent) {
		if (timer && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) pressEnd();
	}

	function tap(i: number) {
		if (longPressed) longPressed = false;
		else viewer.open(i);
	}

	export function show(id: string) {
		const i = photos.findIndex((p) => p.id === id);
		if (i >= 0) viewer.open(i);
	}
</script>

<ul class="grid">
	{#each visible as p, i (p.id)}
		<li>
			<button
				type="button"
				aria-label="{p.label}, {p.date}"
				onclick={() => tap(i)}
				onpointerdown={(e) => pressStart(e, p)}
				onpointermove={pressMove}
				onpointerup={pressEnd}
				onpointercancel={pressEnd}
				onpointerleave={pressEnd}
				oncontextmenu={(e) => (timer || longPressed) && e.preventDefault()}
			>
				<MediaThumb file={p} />
				{#if p.id === coverPhotoId}<span class="cover" title={t.objects.isCover}>★</span>{/if}
			</button>
		</li>
	{/each}
</ul>
{#if photos.length > PREVIEW && !showAll}
	<button type="button" class="small more" onclick={() => (showAll = true)}>
		{t.gallery.showAll(photos.length)}
	</button>
{/if}

{#if canSetCover}
	<form bind:this={coverForm} method="POST" action="?/cover" use:enhance hidden>
		<input type="hidden" name="photo" value={pressedId} />
	</form>
{/if}

<PhotoViewer bind:this={viewer} {photos} {coverPhotoId} {canSetCover} />

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 0.35rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.grid button {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 1;
		padding: 0;
		min-height: 0;
		border: none;
		border-radius: 8px;
		overflow: hidden;
		background: var(--surface-2);
	}
	.cover {
		position: absolute;
		top: 4px;
		left: 4px;
		padding: 0 0.35rem;
		border-radius: 999px;
		background: rgb(0 0 0 / 0.55);
		color: #fff;
		font-size: 0.85rem;
	}
	.more {
		margin-top: 0.5rem;
	}
</style>
