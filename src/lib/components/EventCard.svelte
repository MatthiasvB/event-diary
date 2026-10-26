<!-- An event as a tile: the whole tile opens the editor; photos open the viewer. -->
<script lang="ts">
	import { canEdit, diaryId } from '#lib/paths.ts';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import FileList from './FileList.svelte';
	import MediaThumb from './MediaThumb.svelte';
	import PhotoViewer from './PhotoViewer.svelte';
	import { isMedia } from '#lib/files.ts';
	import { formatDate } from '#lib/format.ts';
	import { showValue } from '#lib/fieldValues.ts';
	import { t } from '#lib/i18n.ts';
	import type { DiaryEvent } from '#lib/types.ts';

	type Props = {
		event: DiaryEvent;
		showPlant?: boolean;
		/** Plant page only: mark and choose the cover image. */
		coverPhotoId?: string | null;
		canSetCover?: boolean;
	};
	let { event, showPlant = false, coverPhotoId = null, canSetCover = false }: Props = $props();

	let viewer = $state<PhotoViewer>();

	// Long notes are cut to a few lines until expanded.
	let expanded = $state(false);
	let long = $state(false);
	function measureNote(node: HTMLElement) {
		const check = () => {
			if (!node.classList.contains('collapsed')) return;
			long = node.scrollHeight > node.clientHeight + 1;
		};
		const observer = new ResizeObserver(check);
		observer.observe(node);
		return () => observer.disconnect();
	}

	// Many photos: three rows until expanded. The number per row follows the width.
	const PHOTO_ROWS = 3;
	let perRow = $state(4);
	let allPhotos = $state(false);
	function measureGrid(node: HTMLElement) {
		const update = () => {
			perRow = getComputedStyle(node).gridTemplateColumns.split(' ').length || 1;
		};
		const observer = new ResizeObserver(update);
		observer.observe(node);
		return () => observer.disconnect();
	}
	const photos = $derived(
		event.files
			.filter((f) => isMedia({ type: f.mime, name: f.name }))
			.map((f) => ({ ...f, date: formatDate(event.date), label: event.typeName }))
	);
	const documents = $derived(event.files.filter((f) => !isMedia({ type: f.mime, name: f.name })));
	const hiddenPhotos = $derived(allPhotos ? 0 : Math.max(0, photos.length - perRow * PHOTO_ROWS));
	const visiblePhotos = $derived(hiddenPhotos ? photos.slice(0, perRow * PHOTO_ROWS) : photos);
</script>

<article class="card" class:milestone={event.milestone}>
	<header class="spread">
		<div>
			<time datetime={event.date}>{formatDate(event.date)}</time>
			<!-- Covers the whole tile (see .open::after); the other controls sit above it. -->
			{#if canEdit()}
				<a
					class="open"
					href={resolve('/[diary]/events/[id]/edit', { diary: diaryId(), id: String(event.id) })}
					><strong>{event.typeName}</strong></a
				>
			{:else}
				<strong>{event.typeName}</strong>
			{/if}
			{#if event.milestone}<span class="badge milestone" title={t.events.milestone}>★</span>{/if}
		</div>
		<div class="row small">
			{#if event.category}<span class="badge">{event.category}</span>{/if}
			{#if event.batchSize > 1}<span class="badge">{t.events.batch(event.batchSize)}</span>{/if}
		</div>
	</header>

	{#if showPlant}
		<p>
			<a
				class="above"
				href={resolve('/[diary]/plants/[id]', { diary: diaryId(), id: event.plantId })}
				>{event.plantName}</a
			>
		</p>
	{/if}

	{#if event.fields.length}
		<ul class="fields">
			{#each event.fields as f (f.target + f.key)}
				<li>
					<span class="muted">{f.key}{f.target === 'plant' ? ' →' : ':'}</span>
					{showValue(f.key, f.value)}
				</li>
			{/each}
		</ul>
	{/if}

	{#if event.note}
		<p class="note" class:collapsed={!expanded} {@attach measureNote}>{event.note}</p>
		{#if long}
			<div>
				<button
					type="button"
					class="link small above"
					aria-expanded={expanded}
					onclick={() => (expanded = !expanded)}
					>{expanded ? t.events.showLess : t.events.showMore}</button
				>
			</div>
		{/if}
	{/if}

	{#if photos.length}
		<ul class="photos" {@attach measureGrid}>
			{#each visiblePhotos as p, i (p.id)}
				<li>
					<button
						type="button"
						class="above"
						onclick={() => viewer?.open(i)}
						aria-label="{p.label}, {p.date}"
					>
						<MediaThumb file={p} />
						{#if canSetCover && p.id === coverPhotoId}
							<span class="cover" title={t.plants.isCover}>★</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
		{#if hiddenPhotos || allPhotos}
			<div>
				<button
					type="button"
					class="link small above"
					aria-expanded={allPhotos}
					onclick={() => (allPhotos = !allPhotos)}
					>{allPhotos ? t.events.showLess : t.gallery.showAll(photos.length)}</button
				>
			</div>
		{/if}
		<PhotoViewer bind:this={viewer} {photos} {coverPhotoId} {canSetCover} />
	{/if}

	{#if documents.length}<FileList files={documents} />{/if}

	{#if canEdit()}
		<footer class="row">
			<a
				class="button small above"
				href={resolve(`/[diary]/events/new?from=${event.id}`, { diary: diaryId() })}
				>{t.common.repeat}</a
			>
			<form
				method="POST"
				action="?/deleteEvent"
				class="above"
				use:enhance={({ cancel }) => {
					if (!confirm(t.events.confirmDelete(event.typeName, formatDate(event.date)))) cancel();
				}}
			>
				<input type="hidden" name="id" value={event.id} />
				<button class="small danger">{t.common.delete}</button>
			</form>
		</footer>
	{/if}
</article>

<style>
	article {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	article:hover {
		border-color: var(--accent);
	}
	article.milestone {
		border-left: 4px solid var(--milestone);
	}
	.open {
		color: inherit;
		text-decoration: none;
	}
	.open::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
	}
	/* Also the links in the file list. */
	article :global(.above) {
		position: relative;
		z-index: 1;
	}
	header time {
		color: var(--muted);
		margin-right: 0.4rem;
	}
	p {
		margin: 0;
	}
	.note {
		white-space: pre-line;
	}
	.note.collapsed {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		overflow: hidden;
	}
	.link {
		padding: 0;
	}
	.fields {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 1rem;
	}
	.photos {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 0.4rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.photos button {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		min-height: 0;
		padding: 0;
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
	footer {
		margin-top: 0.15rem;
	}
	footer form {
		margin-left: auto;
	}
</style>
