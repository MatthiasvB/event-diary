<!-- Square preview of a photo, or of a video (its first frame, marked with ▶). -->
<script lang="ts">
	import { fileUrl, photoUrl } from '#lib/paths.ts';
	import { fileKind, type EventFile } from '#lib/files.ts';

	let { file }: { file: EventFile } = $props();
	const video = $derived(fileKind(file.mime, file.name) === 'video');
</script>

{#if video}
	<!-- Only the metadata and the first frame are loaded. -->
	<video src="{fileUrl(file.id)}#t=0.1" preload="metadata" muted playsinline tabindex="-1"></video>
	<span class="play" aria-hidden="true">▶</span>
{:else}
	<img src={photoUrl(file.id, 's')} alt="" loading="lazy" />
{/if}

<style>
	img,
	video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
		/* no image menu on long press (iOS) */
		-webkit-touch-callout: none;
		user-select: none;
	}
	video {
		background: #000;
	}
	.play {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: #fff;
		font-size: 1.6rem;
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.7);
	}
</style>
