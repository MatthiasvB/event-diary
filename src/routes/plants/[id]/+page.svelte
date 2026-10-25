<script lang="ts">
	import { resolve } from '$app/paths';
	import EventCard from '#lib/components/EventCard.svelte';
	import { formatDate, relativeDays } from '#lib/format.ts';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const plant = $derived(data.plant);
	const attrKeys = $derived(Object.keys(data.history).sort((a, b) => a.localeCompare(b, 'de')));
</script>

<svelte:head><title>{plant.name} · {data.appName}</title></svelte:head>

<header class="head">
	{#if plant.coverPhotoId}
		<a
			href={resolve('/photos/[id]?size=l', { id: plant.coverPhotoId })}
			target="_blank"
			rel="noopener"
		>
			<img class="cover" src="/photos/{plant.coverPhotoId}?size=l" alt={plant.name} />
		</a>
	{/if}
	<div class="spread">
		<div>
			<h1>{plant.name}</h1>
			<p class="row muted">
				<span>{plant.id}</span>
				{#if !plant.active}<span class="badge">{t.plants.inactive}</span>{/if}
				{#if plant.acquiredOn}<span>{t.plants.acquiredOn} {formatDate(plant.acquiredOn)}</span>{/if}
			</p>
		</div>
		<a class="button small" href={resolve('/plants/[id]/edit', { id: plant.id })}>{t.common.edit}</a
		>
	</div>
	<a class="button primary" href={resolve(`/events/new?plant=${encodeURIComponent(plant.id)}`)}
		>+ {t.plants.addEvent}</a
	>
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
					{#if history.length > 1}
						<details>
							<summary class="small">{t.plants.history} ({history.length})</summary>
							<ol class="history small">
								{#each [...history].reverse() as h (h.id)}
									<li>
										<span class="muted">{h.since ? formatDate(h.since) : t.plants.initial}</span>
										{h.value}
										{#if h.eventId}<a href={resolve('/events/[id]/edit', { id: String(h.eventId) })}
												>↗</a
											>{/if}
									</li>
								{/each}
							</ol>
						</details>
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

<section>
	<h2>
		{t.plants.timeline} <span class="muted small">{t.plants.events(data.events.length)}</span>
	</h2>
	<div class="stack timeline">
		{#each data.events as event (event.id)}
			<EventCard {event} coverPhotoId={plant.coverPhotoId} canSetCover />
		{:else}
			<p class="muted">{t.plants.noEvents}</p>
		{/each}
	</div>
</section>

<style>
	.head {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
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
	details {
		margin-top: 0.15rem;
	}
	summary {
		cursor: pointer;
		color: var(--accent);
	}
	.history {
		margin: 0.25rem 0 0;
		padding-left: 1.1rem;
	}
	.last {
		margin-top: 1rem;
	}
	.timeline {
		gap: 0.6rem;
	}
</style>
