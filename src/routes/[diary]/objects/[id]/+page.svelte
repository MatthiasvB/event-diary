<script lang="ts">
	import { canEdit, diaryId, photoUrl } from '#lib/paths.ts';
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import AttrHistory from '#lib/components/AttrHistory.svelte';
	import EventCard from '#lib/components/EventCard.svelte';
	import Gallery from '#lib/components/Gallery.svelte';
	import ObjectPicker from '#lib/components/ObjectPicker.svelte';
	import { formatDate, relativeDays } from '#lib/format.ts';
	import { objectName, showValue } from '#lib/fieldValues.ts';
	import { t } from '#lib/i18n.ts';
	import { dropFiles } from '#lib/dropFiles.ts';
	import { isMedia } from '#lib/files.ts';
	import { openPhotoEvent, startCameraEvent, startPhotoEvent } from '#lib/pending.svelte.ts';
	import { uncropped } from '#lib/upload.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const object = $derived(data.object);
	let gallery = $state<Gallery>();
	let coverHint = $state(false);
	let adding = $state(false);
	let toAdd = $state<number[]>([]);
	const objectHref = (id: number) =>
		resolve('/[diary]/objects/[id]', { diary: diaryId(), id: String(id) });

	let standalone = $state(false);
	onMount(() => {
		standalone =
			matchMedia('(display-mode: standalone)').matches ||
			(navigator as { standalone?: boolean }).standalone === true;
	});
	const photos = $derived(
		data.events
			.flatMap((e) =>
				e.files
					.filter((f) => isMedia({ type: f.mime, name: f.name }))
					.map((f) => ({ ...f, date: e.date, label: e.typeName }))
			)
			.filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i)
	);
</script>

<svelte:head><title>{object.name} · {data.appName}</title></svelte:head>

<div
	class="drop-zone page"
	{@attach canEdit() &&
		dropFiles((files) => openPhotoEvent(files.map(uncropped), object.id), isMedia)}
>
	<header class="head">
		{#if object.coverPhotoId}
			<button
				type="button"
				class="cover-button"
				onclick={() => gallery?.show(object.coverPhotoId!)}
			>
				<!-- Until it loads, the small preview (usually cached from the overview) shows scaled up. -->
				<img
					class="cover"
					src={photoUrl(object.coverPhotoId, 'l')}
					alt={object.name}
					style:aspect-ratio={object.coverRatio ?? 4 / 3}
					style:background-image="url({photoUrl(object.coverPhotoId, 's')})"
				/>
			</button>
		{/if}
		<div class="spread">
			<div>
				<h1>{object.name}</h1>
				{#if !object.active}<p class="row muted">
						<span class="badge">{t.objects.inactive}</span>
					</p>{/if}
			</div>
			{#if canEdit()}
				<a
					class="button small"
					href={resolve('/[diary]/objects/[id]/edit', { diary: diaryId(), id: String(object.id) })}
					>{t.common.edit}</a
				>
			{/if}
		</div>
		{#if canEdit()}
			<div class="actions">
				<a
					class="button primary"
					href={resolve(`/[diary]/events/new?object=${object.id}`, {
						diary: diaryId()
					})}>+ {t.objects.addEvent}</a
				>
				<div class="row">
					<label class="button primary">
						<input
							type="file"
							accept="image/*"
							capture="environment"
							class="visually-hidden"
							onchange={(e) => startCameraEvent(e, object.id)}
						/>
						📷 {t.objects.takePhoto}
					</label>
					<!-- The installed app opens the camera directly. A browser also offers the gallery. -->
					{#if standalone}
						<label class="button primary">
							<input
								type="file"
								accept="image/*,video/*"
								multiple
								class="visually-hidden"
								onchange={(e) => startPhotoEvent(e, object.id)}
							/>
							🖼 {t.objects.fromGallery}
						</label>
					{/if}
				</div>
			</div>
			<p class="drop-hint muted small">{t.photos.dropHint}</p>
		{/if}
	</header>

	{#if object.notes}<p class="notes">{object.notes}</p>{/if}

	{#if data.attrKeys.length}
		<section>
			<h2>{t.objects.attributes}</h2>
			<dl class="attrs">
				{#each data.attrKeys as key (key)}
					{@const history = data.history[key]}
					{@const current = history[history.length - 1]}
					<dt>{key}</dt>
					<dd>
						{#if data.paths[key]?.length}
							{#each data.paths[key] as id, i (id)}
								{#if i}<span class="muted separator">›</span>{/if}<a href={objectHref(id)}
									>{objectName(id)}</a
								>
							{/each}
						{:else}
							{showValue(key, current.value)}
						{/if}
						{#if current.since}<span class="muted small"
								>{t.objects.since} {formatDate(current.since)}</span
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

	{#if data.associated.length || (canEdit() && data.associations.length)}
		<section class="stack associated">
			<h2>{t.associations.here}</h2>
			{#each data.associated as { key, ids } (key)}
				<div>
					<h3 class="muted small">{key}</h3>
					<ul class="links">
						{#each ids as id (id)}<li><a href={objectHref(id)}>{objectName(id)}</a></li>{/each}
					</ul>
				</div>
			{/each}
			{#if canEdit() && data.associations.length}
				{#if adding}
					<form
						method="POST"
						action="?/associate"
						class="stack"
						use:enhance={() =>
							async ({ result, update }) => {
								await update();
								if (result.type === 'success') {
									adding = false;
									toAdd = [];
								}
							}}
					>
						<label>
							{t.associations.association}
							<select name="key">
								{#each data.associations as key (key)}<option value={key}>{key}</option>{/each}
							</select>
						</label>
						<ObjectPicker objects={data.objects} bind:selected={toAdd} />
						{#each toAdd as id (id)}<input type="hidden" name="object" value={id} />{/each}
						{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
						<div class="row">
							<button class="primary" disabled={!toAdd.length}>{t.common.save}</button>
							<button type="button" onclick={() => (adding = false)}>{t.common.cancel}</button>
						</div>
					</form>
				{:else}
					<div>
						<button type="button" onclick={() => (adding = true)}>+ {t.associations.add}</button>
					</div>
				{/if}
			{/if}
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
			<h2>
				{t.objects.photos} <span class="muted small">{photos.length}</span>
				{#if canEdit()}
					<button
						type="button"
						class="info"
						aria-label={t.gallery.coverHelp}
						aria-expanded={coverHint}
						onclick={() => (coverHint = !coverHint)}>ⓘ</button
					>
				{/if}
			</h2>
			{#if coverHint}<p class="muted small cover-hint">{t.gallery.longPressHint}</p>{/if}
			<Gallery
				bind:this={gallery}
				{photos}
				coverPhotoId={object.coverPhotoId}
				canSetCover={canEdit()}
			/>
		</section>
	{/if}

	<section>
		<h2>
			{t.objects.timeline} <span class="muted small">{t.objects.events(data.events.length)}</span>
		</h2>
		<div class="stack timeline">
			{#each data.events as event (event.id)}
				<EventCard
					{event}
					objectId={object.id}
					coverPhotoId={object.coverPhotoId}
					canSetCover={canEdit()}
				/>
			{:else}
				<p class="muted">{t.objects.noEvents}</p>
			{/each}
		</div>
	</section>
</div>

<style>
	.associated {
		gap: 0.6rem;
	}
	.associated h3 {
		margin: 0 0 0.2rem;
		font-weight: normal;
	}
	.links {
		margin: 0;
		padding-left: 1.2rem;
	}
	.separator {
		margin: 0 0.35em;
	}
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
		display: block;
		width: 100%;
		max-height: 50vh;
		object-fit: cover;
		border-radius: var(--radius);
		background-color: var(--surface-2);
		background-size: cover;
		background-position: center;
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
	.info {
		min-height: 0;
		padding: 0 0.3rem;
		border: none;
		background: none;
		color: var(--muted);
		font-size: 1rem;
		vertical-align: middle;
	}
	.cover-hint {
		margin: -0.25rem 0 0.5rem;
	}
	.timeline {
		gap: 0.6rem;
	}
</style>
