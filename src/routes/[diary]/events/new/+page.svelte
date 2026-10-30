<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import EventForm from '#lib/components/EventForm.svelte';
	import { t } from '#lib/i18n.ts';
	import { pendingPhotos } from '#lib/pending.svelte.ts';
	import { takeSharedPhotos } from '#lib/share.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let files = $state(pendingPhotos.files);
	pendingPhotos.files = [];
	const shared = untrack(() => data.shared);
	let ready = $state(!shared);

	onMount(async () => {
		if (shared) {
			files = [...files, ...(await takeSharedPhotos())];
			ready = true;
		}
	});
</script>

<svelte:head><title>{t.events.new} · {data.appName}</title></svelte:head>

<h1>{t.events.new}</h1>
{#if ready}
	{#key data.initial}
		<EventForm
			objects={data.objects}
			vocab={data.vocab}
			lastFields={data.lastFields}
			histories={data.histories}
			initial={data.initial}
			photoMode={data.photoMode}
			bind:files
			error={form?.error}
		/>
	{/key}
{/if}
