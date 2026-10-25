<script lang="ts">
	import EventForm from '#lib/components/EventForm.svelte';
	import { t } from '#lib/i18n.ts';
	import { pendingPhotos } from '#lib/pending.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Photos taken with the camera shortcut in the navigation.
	let files = $state(pendingPhotos.files);
	pendingPhotos.files = [];
</script>

<svelte:head><title>{t.events.new} · {data.appName}</title></svelte:head>

<h1>{t.events.new}</h1>
{#key data.initial}
	<EventForm
		plants={data.plants}
		vocab={data.vocab}
		lastFields={data.lastFields}
		initial={data.initial}
		photoMode={data.photoMode}
		bind:files
		error={form?.error}
	/>
{/key}
