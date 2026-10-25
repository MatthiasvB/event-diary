<script lang="ts">
	import { enhance } from '$app/forms';
	import PlantForm from '#lib/components/PlantForm.svelte';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{t.plants.edit} · {data.appName}</title></svelte:head>

<h1>{t.plants.edit}</h1>
{#key data.plant.id}
	<PlantForm plant={data.plant} attrs={data.attrs} vocab={data.vocab} error={form?.error} />
{/key}

<form
	method="POST"
	action="?/delete"
	class="delete stack"
	use:enhance={({ cancel }) => {
		if (!confirm(t.common.confirmDelete)) cancel();
	}}
>
	<p class="muted small">{t.plants.deleteOnlyEmpty}</p>
	<div><button class="danger">{t.common.delete}</button></div>
</form>

<style>
	.delete {
		margin-top: 2.5rem;
	}
	p {
		margin: 0;
	}
</style>
