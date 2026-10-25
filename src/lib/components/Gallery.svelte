<!-- Thumbnail grid; a tap opens the photo viewer. -->
<script lang="ts">
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

	/** Opens the viewer at a photo, e.g. from the cover image. */
	export function show(id: string) {
		const i = photos.findIndex((p) => p.id === id);
		if (i >= 0) viewer.open(i);
	}
</script>

<ul class="grid">
	{#each visible as p, i (p.id)}
		<li>
			<button type="button" onclick={() => viewer.open(i)} aria-label="{p.label}, {p.date}">
				<img src="/photos/{p.id}?size=s" alt="" loading="lazy" />
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
