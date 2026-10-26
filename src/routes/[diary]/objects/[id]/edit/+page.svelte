<script lang="ts">
	import { enhance } from '$app/forms';
	import ObjectForm from '#lib/components/ObjectForm.svelte';
	import { t } from '#lib/i18n.ts';
	import { leaveFormOnRedirect } from '#lib/leaveForm.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const leave = leaveFormOnRedirect();
</script>

<svelte:head><title>{t.objects.edit} · {data.appName}</title></svelte:head>

<h1>{t.objects.edit}</h1>
{#key data.object.id}
	<ObjectForm object={data.object} attrs={data.attrs} vocab={data.vocab} error={form?.error} />
{/key}

<form
	method="POST"
	action="?/delete"
	class="delete stack"
	use:enhance={({ cancel }) => {
		if (!confirm(t.objects.confirmDelete(data.object.name, data.impact))) cancel();
		return leave;
	}}
>
	<p class="muted small">{t.objects.deleteHint}</p>
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
