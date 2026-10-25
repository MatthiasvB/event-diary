<!-- Thumbnail grid; a tap opens the photo viewer. -->
<script lang="ts">
	import { photoUrl } from '#lib/paths.ts';
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import PhotoViewer, { type ViewerPhoto } from './PhotoViewer.svelte';
	import { t } from '#lib/i18n.ts';

	type Props = {
		photos: ViewerPhoto[];
		coverPhotoId?: string | null;
		/** Offer choosing the cover image (posts to the page's `?/cover` action). */
		canSetCover?: boolean;
	};

	let { photos, coverPhotoId = null, canSetCover = false }: Props = $props();

	const PREVIEW = 9;
	let showAll = $state(false);
	let viewer: PhotoViewer;

	const visible = $derived(showAll ? photos : photos.slice(0, PREVIEW));

	// Long press on a photo makes it the cover image.
	const LONG_PRESS_MS = 500;
	let coverForm = $state<HTMLFormElement>();
	let pressedId = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;
	let start = { x: 0, y: 0 };
	let longPressed = false;

	function pressStart(e: PointerEvent, id: string) {
		longPressed = false;
		if (!canSetCover || e.button !== 0) return;
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

	/** Opens the viewer at a photo, e.g. from the cover image. */
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
				onpointerdown={(e) => pressStart(e, p.id)}
				onpointermove={pressMove}
				onpointerup={pressEnd}
				onpointercancel={pressEnd}
				onpointerleave={pressEnd}
				oncontextmenu={(e) => (timer || longPressed) && e.preventDefault()}
			>
				<img src={photoUrl(p.id, 's')} alt="" loading="lazy" />
				{#if p.id === coverPhotoId}<span class="cover" title={t.plants.isCover}>★</span>{/if}
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
	<p class="muted small hint">{t.gallery.longPressHint}</p>
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
	.grid img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* no image menu on long press (iOS) */
		-webkit-touch-callout: none;
		user-select: none;
	}
	.hint {
		margin: 0.4rem 0 0;
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
