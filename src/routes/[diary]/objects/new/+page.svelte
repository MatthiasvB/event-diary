<script lang="ts">
	import { diaryId } from '#lib/paths.ts';
	import { resolve } from '$app/paths';
	import ObjectForm from '#lib/components/ObjectForm.svelte';
	import { t } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{t.objects.new} · {data.appName}</title></svelte:head>

<h1>{t.objects.new}</h1>
{#if data.created}
	<p class="notice">
		{t.objects.created(data.created.name)}
		<a href={resolve('/[diary]/objects/[id]', { diary: diaryId(), id: String(data.created.id) })}
			>{t.objects.view}</a
		>
	</p>
{/if}
<!-- Each "save & next" starts a fresh form. -->
{#key data.created?.id}
	<ObjectForm
		object={data.object}
		attrs={data.attrs}
		vocab={data.vocab}
		isNew
		error={form?.error}
	/>
{/key}

<style>
	.notice {
		margin-bottom: 1rem;
	}
</style>
