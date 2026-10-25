<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import EventForm from '#lib/components/EventForm.svelte';
	import { t } from '#lib/i18n.ts';
	import { leaveFormOnRedirect } from '#lib/leaveForm.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const leave = leaveFormOnRedirect();
</script>

<svelte:head><title>{t.events.edit} · {data.appName}</title></svelte:head>

<div class="spread">
	<h1>{t.events.edit}</h1>
	<a class="button small" href={resolve(`/events/new?from=${data.event.id}`)}>{t.common.repeat}</a>
</div>

{#key data.event.id}
	<EventForm
		plants={data.plants}
		vocab={data.vocab}
		lastFields={data.lastFields}
		initial={data.initial}
		edit
		batchSize={data.event.batchSize}
		error={form?.error}
	/>
{/key}

<form
	method="POST"
	action="?/delete"
	class="delete"
	use:enhance={({ cancel }) => {
		if (!confirm(t.common.confirmDelete)) cancel();
		return leave;
	}}
>
	<button class="danger">{t.common.delete}</button>
</form>

<style>
	.delete {
		margin-top: 2.5rem;
	}
</style>
