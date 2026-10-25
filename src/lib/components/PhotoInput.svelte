<!-- Camera and gallery buttons; collects files and reports the earliest EXIF capture date. -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { isoDate } from '#lib/format.ts';
	import { t } from '#lib/i18n.ts';

	type Props = {
		files: File[];
		onexifdate?: (date: string) => void;
		/** Highlight the camera button. */
		prominent?: boolean;
	};
	let { files = $bindable(), onexifdate, prominent = false }: Props = $props();

	// Plain cache of object URLs, not reactive state.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const urls = new Map<File, string>();
	function preview(file: File) {
		let url = urls.get(file);
		if (!url) {
			url = URL.createObjectURL(file);
			urls.set(file, url);
		}
		return url;
	}
	onDestroy(() => urls.forEach((u) => URL.revokeObjectURL(u)));

	async function captureDate(list: File[]) {
		const { default: exifr } = await import('exifr');
		const dates: string[] = [];
		for (const f of list) {
			try {
				const exif = await exifr.parse(f, ['DateTimeOriginal', 'CreateDate']);
				const d = exif?.DateTimeOriginal ?? exif?.CreateDate;
				if (d instanceof Date && !Number.isNaN(d.getTime())) dates.push(isoDate(d));
			} catch {
				// no EXIF data
			}
		}
		if (dates.length) onexifdate?.(dates.sort()[0]);
	}

	function add(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const added = [...(input.files ?? [])];
		input.value = '';
		if (!added.length) return;
		files = [...files, ...added];
		captureDate(added);
	}

	// Files passed in from outside (camera shortcut) also offer their date.
	onMount(() => {
		if (files.length) captureDate(files);
	});
</script>

<div class="stack photos">
	<div class="row">
		<label class="button" class:primary={prominent}>
			<input
				type="file"
				accept="image/*"
				capture="environment"
				class="visually-hidden"
				onchange={add}
			/>
			📷 {t.events.camera}
		</label>
		<label class="button">
			<input type="file" accept="image/*" multiple class="visually-hidden" onchange={add} />
			🖼 {t.events.gallery}
		</label>
	</div>
	{#if files.length}
		<ul class="thumbs">
			{#each files as file (file)}
				<li>
					<img
						src={preview(file)}
						alt={file.name}
						onerror={(e) => e.currentTarget.classList.add('broken')}
					/>
					<span class="name small">{file.name}</span>
					<button
						type="button"
						class="remove"
						aria-label={t.events.removePhoto}
						onclick={() => (files = files.filter((f) => f !== file))}>×</button
					>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	label.button {
		color: var(--text);
		font-size: 1rem;
	}
	label.button.primary {
		color: var(--accent-text);
	}
	label.button:focus-within {
		outline: 2px solid var(--accent);
	}
	.thumbs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
		gap: 0.4rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		position: relative;
		aspect-ratio: 1;
		border-radius: 8px;
		overflow: hidden;
		background: var(--surface-2);
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/* e.g. HEIC outside Safari: show the file name instead */
	:global(img.broken) {
		display: none;
	}
	.name {
		position: absolute;
		inset: auto 0 0 0;
		padding: 0.15rem 0.3rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		background: rgb(0 0 0 / 0.45);
		color: #fff;
	}
	.remove {
		position: absolute;
		top: 2px;
		right: 2px;
		min-height: 0;
		width: 28px;
		height: 28px;
		padding: 0;
		border-radius: 50%;
		background: rgb(0 0 0 / 0.55);
		color: #fff;
		border: none;
	}
</style>
