<script lang="ts">
	import { canEdit, diaryId, photoUrl } from '#lib/paths.ts';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import AttrHistory from '#lib/components/AttrHistory.svelte';
	import EventCard from '#lib/components/EventCard.svelte';
	import Gallery from '#lib/components/Gallery.svelte';
	import { formatDate, relativeDays } from '#lib/format.ts';
	import { t } from '#lib/i18n.ts';
	import { dropFiles } from '#lib/dropFiles.ts';
	import { isMedia } from '#lib/files.ts';
	import { openPhotoEvent, startPhotoEvent } from '#lib/pending.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const plant = $derived(data.plant);
	let gallery = $state<Gallery>();

	// Running as installed app (home screen) rather than in a browser tab.
	let standalone = $state(false);
	onMount(() => {
		standalone =
			matchMedia('(display-mode: standalone)').matches ||
			(navigator as { standalone?: boolean }).standalone === true;
	});
	// All photos and videos of the object, newest first (events are sorted newest first).
	const photos = $derived(
		data.events
			.flatMap((e) =>
				e.files
					.filter((f) => isMedia({ type: f.mime, name: f.name }))
					.map((f) => ({ ...f, date: e.date, label: e.typeName }))
			)
			.filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i)
	);
	const attrKeys = $derived(Object.keys(data.history).sort((a, b) => a.localeCompare(b, 'de')));
</script>

<svelte:head><title>{plant.name} · {data.appName}</title></svelte:head>

<div
	class="drop-zone page"
	{@attach canEdit() && dropFiles((files) => openPhotoEvent(files, plant.id), isMedia)}
>
	<header class="head">
		{#if plant.coverPhotoId}
			<button type="button" class="cover-button" onclick={() => gallery?.show(plant.coverPhotoId!)}>
				<img class="cover" src={photoUrl(plant.coverPhotoId, 'l')} alt={plant.name} />
			</button>
		{/if}
		<div class="spread">
			<div>
				<h1>{plant.name}</h1>
				{#if !plant.active || plant.acquiredOn}
					<p class="row muted">
						{#if !plant.active}<span class="badge">{t.plants.inactive}</span>{/if}
						{#if plant.acquiredOn}<span>{t.plants.acquiredOn} {formatDate(plant.acquiredOn)}</span
							>{/if}
					</p>
				{/if}
			</div>
			{#if canEdit()}
				<a
					class="button small"
					href={resolve('/[diary]/plants/[id]/edit', { diary: diaryId(), id: plant.id })}
					>{t.common.edit}</a
				>
			{/if}
		</div>
		{#if canEdit()}
			<div class="actions">
				<a
					class="button primary"
					href={resolve(`/[diary]/events/new?plant=${encodeURIComponent(plant.id)}`, {
						diary: diaryId()
					})}>+ {t.plants.addEvent}</a
				>
				<div class="row">
					<label class="button primary">
						<input
							type="file"
							accept="image/*"
							capture="environment"
							class="visually-hidden"
							onchange={(e) => startPhotoEvent(e, plant.id)}
						/>
						📷 {t.plants.takePhoto}
					</label>
					<!-- The installed app opens the camera directly; a browser also offers the gallery. -->
					{#if standalone}
						<label class="button primary">
							<input
								type="file"
								accept="image/*,video/*"
								multiple
								class="visually-hidden"
								onchange={(e) => startPhotoEvent(e, plant.id)}
							/>
							🖼 {t.plants.fromGallery}
						</label>
					{/if}
				</div>
			</div>
			<p class="drop-hint muted small">{t.photos.dropHint}</p>
		{/if}
	</header>

	{#if plant.notes}<p class="notes">{plant.notes}</p>{/if}

	{#if attrKeys.length}
		<section>
			<h2>{t.plants.attributes}</h2>
			<dl class="attrs">
				{#each attrKeys as key (key)}
					{@const history = data.history[key]}
					{@const current = history[history.length - 1]}
					<dt>{key}</dt>
					<dd>
						{current.value}
						{#if current.since}<span class="muted small"
								>{t.plants.since} {formatDate(current.since)}</span
							>{/if}
						{#if history.length > 1 || history[0].since}
							<AttrHistory
								{key}
								{history}
								candidates={(data.values[key] ?? []).map(({ value, count, last }) => ({
									value,
									count,
									last
								}))}
							/>
						{/if}
					</dd>
				{/each}
			</dl>
		</section>
	{/if}

	{#if data.lastDates.some((l) => l.date)}
		<section>
			<dl class="attrs last">
				{#each data.lastDates as l (l.label)}
					{#if l.date}
						<dt>{l.label}</dt>
						<dd>{relativeDays(l.date)} <span class="muted small">{formatDate(l.date)}</span></dd>
					{/if}
				{/each}
			</dl>
		</section>
	{/if}

	{#if photos.length}
		<section>
			<h2>{t.plants.photos} <span class="muted small">{photos.length}</span></h2>
			<Gallery
				bind:this={gallery}
				{photos}
				coverPhotoId={plant.coverPhotoId}
				canSetCover={canEdit()}
			/>
		</section>
	{/if}

	<section>
		<h2>
			{t.plants.timeline} <span class="muted small">{t.plants.events(data.events.length)}</span>
		</h2>
		<div class="stack timeline">
			{#each data.events as event (event.id)}
				<EventCard {event} coverPhotoId={plant.coverPhotoId} canSetCover={canEdit()} />
			{:else}
				<p class="muted">{t.plants.noEvents}</p>
			{/each}
		</div>
	</section>
</div>

<style>
	.head {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.actions .row > * {
		flex: 1;
	}
	.actions label {
		color: var(--accent-text);
		font-size: 1rem;
	}
	.actions label:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.cover-button {
		display: block;
		width: 100%;
		padding: 0;
		border: none;
		background: none;
	}
	.cover {
		width: 100%;
		max-height: 50vh;
		object-fit: cover;
		border-radius: var(--radius);
	}
	h1 {
		margin: 0;
	}
	.head p,
	.notes {
		margin: 0.25rem 0 0;
	}
	.notes {
		margin-top: 1rem;
		white-space: pre-line;
	}
	.last {
		margin-top: 1rem;
	}
	.timeline {
		gap: 0.6rem;
	}
</style>
