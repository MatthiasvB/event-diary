<script lang="ts">
	import PlantForm from '#lib/components/PlantForm.svelte';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{t.plants.new} · {data.appName}</title></svelte:head>

<h1>{t.plants.new}</h1>
<PlantForm plant={data.plant} attrs={data.attrs} vocab={data.vocab} isNew error={form?.error} />
