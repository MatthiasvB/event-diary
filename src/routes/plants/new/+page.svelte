<script lang="ts">
	import { resolve } from '$app/paths';
	import PlantForm from '#lib/components/PlantForm.svelte';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{t.plants.new} · {data.appName}</title></svelte:head>

<h1>{t.plants.new}</h1>
{#if data.created}
	<p class="notice">
		{t.plants.created(data.created.name, data.created.id)}
		<a href={resolve('/plants/[id]', { id: data.created.id })}>{t.plants.view}</a>
	</p>
{/if}
{#key data.plant.id}
	<PlantForm plant={data.plant} attrs={data.attrs} vocab={data.vocab} isNew error={form?.error} />
{/key}

<style>
	.notice {
		margin-bottom: 1rem;
	}
</style>
