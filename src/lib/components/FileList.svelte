<!-- Attached documents and other files: download, and view where the browser can. -->
<script lang="ts">
	import { fileUrl } from '#lib/paths.ts';
	import { canView, type EventFile } from '#lib/files.ts';
	import { t } from '#lib/i18n.ts';

	let { files }: { files: EventFile[] } = $props();
</script>

<ul class="files">
	{#each files as file (file.id)}
		<li>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve() -->
			<a class="above" href={fileUrl(file.id, true)} download={file.name}>📎 {file.name}</a>
			{#if canView(file.mime)}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve() -->
				<a class="above small" href={fileUrl(file.id)} target="_blank" rel="noopener"
					>{t.files.view}</a
				>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.files {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		min-width: 0;
	}
	li > a:first-child {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
