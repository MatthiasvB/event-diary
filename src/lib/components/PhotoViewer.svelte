<!--
	Full-screen viewer for photos and videos (buttons, arrow keys, swipe). Opening it adds a
	history entry, so the back button or gesture closes the viewer instead of leaving the page.
-->
<script lang="ts">
	import { fileUrl, photoUrl } from '#lib/paths.ts';
	import { fileKind, type EventFile } from '#lib/files.ts';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t } from '#lib/i18n.ts';

	export type ViewerPhoto = EventFile & { date: string; label: string };
	type Props = {
		photos: ViewerPhoto[];
		coverPhotoId?: string | null;
		/** Offer choosing the cover image (posts to the page's `?/cover` action). */
		canSetCover?: boolean;
	};
	let { photos, coverPhotoId = null, canSetCover = false }: Props = $props();

	const uid = $props.id();
	let dialog: HTMLDialogElement;
	let current = $state(0);
	let touchStartX = 0;

	const isOpen = $derived(page.state.viewer === uid);
	const photo = $derived(photos[Math.min(current, photos.length - 1)]);
	const video = $derived(!!photo && fileKind(photo.mime, photo.name) === 'video');
	// Swipes and arrow keys on a video belong to its player (seeking).
	let onVideo = false;

	export function open(index: number) {
		current = index;
		// Same page, only a history entry for the viewer (shallow routing).
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(page.url.pathname + page.url.search, { shallow: true, state: { viewer: uid } });
	}

	function close() {
		if (isOpen) history.back();
	}

	$effect(() => {
		if (isOpen && !dialog.open) dialog.showModal();
		else if (!isOpen && dialog.open) dialog.close();
	});

	function step(delta: number) {
		current = (current + delta + photos.length) % photos.length;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLVideoElement) return;
		if (e.key === 'ArrowLeft') step(-1);
		else if (e.key === 'ArrowRight') step(1);
	}

	function ontouchend(e: TouchEvent) {
		if (onVideo) return;
		const dx = e.changedTouches[0].clientX - touchStartX;
		if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
	}
</script>

<dialog
	bind:this={dialog}
	aria-label={t.objects.photos}
	onclose={close}
	{onkeydown}
	ontouchstart={(e) => {
		touchStartX = e.touches[0].clientX;
		onVideo = e.target instanceof HTMLVideoElement;
	}}
	{ontouchend}
>
	{#if isOpen && photo}
		{#if video}
			{#key photo.id}
				<!-- Own recordings come without captions. -->
				<!-- svelte-ignore a11y_media_has_caption -->
				<video src={fileUrl(photo.id)} controls autoplay playsinline aria-label={photo.label}
				></video>
			{/key}
		{:else}
			<img src={photoUrl(photo.id, 'l')} alt="{photo.label}, {photo.date}" />
		{/if}
		<div class="bar">
			{#if photos.length > 1}
				<button type="button" aria-label={t.gallery.previous} onclick={() => step(-1)}>‹</button>
			{/if}
			<p>
				{photo.date} · {photo.label}
				{#if photos.length > 1}<span class="muted">{current + 1}/{photos.length}</span>{/if}
			</p>
			{#if photos.length > 1}
				<button type="button" aria-label={t.gallery.next} onclick={() => step(1)}>›</button>
			{/if}
		</div>
		<div class="top">
			{#if canSetCover && !video}
				{#if photo.id === coverPhotoId}
					<span class="badge">★ {t.objects.isCover}</span>
				{:else}
					<form method="POST" action="?/cover" use:enhance>
						<input type="hidden" name="photo" value={photo.id} />
						<button class="small">☆ {t.objects.cover}</button>
					</form>
				{/if}
			{/if}
			<!-- Served as a download, so it doesn't leave the app. -->
			<a class="button small" href={fileUrl(photo.id, true)}>⬇ {t.gallery.original}</a>
			<button type="button" class="small" onclick={close}>{t.gallery.close}</button>
		</div>
	{/if}
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
		align-items: center;
		justify-content: center;
	}
	dialog > img,
	dialog > video {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	/* Room for the bars, so the player's own controls stay reachable. */
	dialog > video {
		max-height: calc(100% - 7rem);
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
