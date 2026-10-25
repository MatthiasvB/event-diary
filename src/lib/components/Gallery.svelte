<!-- Thumbnail grid with a full-screen viewer (buttons, arrow keys, swipe). -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n.ts';

	export type GalleryPhoto = { id: string; date: string; label: string };
	type Props = {
		photos: GalleryPhoto[];
		coverPhotoId?: string | null;
		/** Offer choosing the cover image (posts to the page's `?/cover` action). */
		canSetCover?: boolean;
	};

	let { photos, coverPhotoId = null, canSetCover = false }: Props = $props();

	const PREVIEW = 9;
	let showAll = $state(false);
	let current = $state<number | null>(null);
	let dialog: HTMLDialogElement;
	let touchStartX = 0;

	const visible = $derived(showAll ? photos : photos.slice(0, PREVIEW));
	const photo = $derived(current === null ? undefined : photos[current]);

	function openAt(i: number) {
		current = i;
		dialog.showModal();
	}

	function step(delta: number) {
		if (current !== null) current = (current + delta + photos.length) % photos.length;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') step(-1);
		else if (e.key === 'ArrowRight') step(1);
	}

	function ontouchend(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - touchStartX;
		if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
	}
</script>

<ul class="grid">
	{#each visible as p, i (p.id)}
		<li>
			<button type="button" onclick={() => openAt(i)} aria-label="{p.label}, {p.date}">
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

<dialog
	bind:this={dialog}
	aria-label={t.plants.photos}
	onclose={() => (current = null)}
	{onkeydown}
	ontouchstart={(e) => (touchStartX = e.touches[0].clientX)}
	{ontouchend}
>
	{#if photo && current !== null}
		<img src="/photos/{photo.id}?size=l" alt="{photo.label}, {photo.date}" />
		<div class="bar">
			<button type="button" aria-label={t.gallery.previous} onclick={() => step(-1)}>‹</button>
			<p>
				{photo.date} · {photo.label}
				<span class="muted">{current + 1}/{photos.length}</span>
			</p>
			<button type="button" aria-label={t.gallery.next} onclick={() => step(1)}>›</button>
		</div>
		<div class="top">
			{#if canSetCover}
				{#if photo.id === coverPhotoId}
					<span class="badge">★ {t.plants.isCover}</span>
				{:else}
					<form method="POST" action="?/cover" use:enhance>
						<input type="hidden" name="photo" value={photo.id} />
						<button class="small">☆ {t.plants.cover}</button>
					</form>
				{/if}
			{/if}
			<a
				class="button small"
				href={resolve('/photos/[id]?size=original', { id: photo.id })}
				target="_blank"
				rel="noopener">{t.gallery.original}</a
			>
			<button type="button" class="small" onclick={() => dialog.close()}>{t.gallery.close}</button>
		</div>
	{/if}
</dialog>

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
		align-items: center;
		justify-content: center;
	}
	dialog > img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	.bar,
	.top {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem calc(0.6rem + env(safe-area-inset-right)) 0.6rem
			calc(0.6rem + env(safe-area-inset-left));
		background: rgb(0 0 0 / 0.5);
	}
	.top {
		top: 0;
		justify-content: flex-end;
		padding-top: calc(0.6rem + env(safe-area-inset-top));
	}
	.bar {
		bottom: 0;
		padding-bottom: calc(0.6rem + env(safe-area-inset-bottom));
	}
	.bar p {
		flex: 1;
		margin: 0;
		text-align: center;
		font-size: 0.9rem;
	}
	.bar .muted {
		color: #bbb;
		margin-left: 0.3rem;
	}
	.top .badge {
		padding: 0.3rem 0.7rem;
		font-size: 0.9rem;
	}
	.bar button {
		width: 48px;
		font-size: 1.8rem;
		line-height: 1;
		padding: 0;
		background: rgb(255 255 255 / 0.15);
		border: none;
		color: #fff;
	}
</style>
