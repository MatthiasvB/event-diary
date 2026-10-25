<!-- An event as a tile: the whole tile opens the editor; photos open the viewer. -->
<script lang="ts">
	import { diaryId, photoUrl } from '#lib/paths.ts';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PhotoViewer from './PhotoViewer.svelte';
	import { formatDate } from '#lib/format.ts';
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
	const photos = $derived(
		event.photos.map((id) => ({ id, date: formatDate(event.date), label: event.typeName }))
	);
</script>

<article class="card" class:milestone={event.milestone}>
	<header class="spread">
		<div>
			<time datetime={event.date}>{formatDate(event.date)}</time>
			<!-- Covers the whole tile (see .open::after); the other controls sit above it. -->
			<a
				class="open"
				href={resolve('/[diary]/events/[id]/edit', { diary: diaryId(), id: String(event.id) })}
				><strong>{event.typeName}</strong></a
			>
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
			<span class="muted small">{event.plantId}</span>
		</p>
	{/if}

	{#if event.fields.length}
		<ul class="fields">
			{#each event.fields as f (f.target + f.key)}
				<li><span class="muted">{f.key}{f.target === 'plant' ? ' →' : ':'}</span> {f.value}</li>
			{/each}
		</ul>
	{/if}

	{#if event.note}<p class="note">{event.note}</p>{/if}

	{#if photos.length}
		<ul class="photos">
			{#each photos as p, i (p.id)}
				<li>
					<button
						type="button"
						class="above"
						onclick={() => viewer?.open(i)}
						aria-label="{p.label}, {p.date}"
					>
						<img src={photoUrl(p.id, 's')} alt="" loading="lazy" />
						{#if canSetCover && p.id === coverPhotoId}
							<span class="cover" title={t.plants.isCover}>★</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
		<PhotoViewer bind:this={viewer} {photos} {coverPhotoId} {canSetCover} />
	{/if}

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
	.above {
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
	.photos img {
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
	footer {
		margin-top: 0.15rem;
	}
	footer form {
		margin-left: auto;
	}
</style>
