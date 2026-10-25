<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { formatDate } from '#lib/format.ts';
	import { t } from '#lib/i18n.ts';
	import type { DiaryEvent } from '#lib/types.ts';

	type Props = {
		event: DiaryEvent;
		showPlant?: boolean;
		/** Plant page only: offer photos as cover image. */
		coverPhotoId?: string | null;
		canSetCover?: boolean;
	};
	let { event, showPlant = false, coverPhotoId = null, canSetCover = false }: Props = $props();
</script>

<article class="card" class:milestone={event.milestone}>
	<header class="spread">
		<div>
			<time datetime={event.date}>{formatDate(event.date)}</time>
			<strong>{event.typeName}</strong>
			{#if event.milestone}<span class="badge milestone" title={t.events.milestone}>★</span>{/if}
		</div>
		<div class="row small">
			{#if event.category}<span class="badge">{event.category}</span>{/if}
			{#if event.batchSize > 1}<span class="badge">{t.events.batch(event.batchSize)}</span>{/if}
		</div>
	</header>

	{#if showPlant}
		<p>
			<a href={resolve('/plants/[id]', { id: event.plantId })}>{event.plantName}</a>
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

	{#if event.photos.length}
		<ul class="photos">
			{#each event.photos as id (id)}
				<li>
					<a href={resolve('/photos/[id]?size=l', { id })} target="_blank" rel="noopener">
						<img
							src="/photos/{id}?size=s"
							alt="{event.typeName}, {formatDate(event.date)}"
							loading="lazy"
						/>
					</a>
					{#if canSetCover}
						{#if coverPhotoId === id}
							<span class="badge">{t.plants.isCover}</span>
						{:else}
							<form method="POST" action="?/cover" use:enhance>
								<input type="hidden" name="photo" value={id} />
								<button class="link small">{t.plants.cover}</button>
							</form>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<footer class="row">
		<a class="button small" href={resolve('/events/[id]/edit', { id: String(event.id) })}
			>{t.common.edit}</a
		>
		<a class="button small" href={resolve(`/events/new?from=${event.id}`)}>{t.common.repeat}</a>
	</footer>
</article>

<style>
	article {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	article.milestone {
		border-left: 4px solid var(--milestone);
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
	.photos img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 8px;
		background: var(--surface-2);
	}
	.photos li {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
	}
</style>
