<!-- A text field with a × that empties it. -->
<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { t } from '#lib/i18n.ts';

	type Props = Omit<HTMLInputAttributes, 'value'> & { value?: string };
	let { value = $bindable(''), ...rest }: Props = $props();
	let input: HTMLInputElement;
</script>

<div class="has-clear">
	<input bind:this={input} bind:value {...rest} />
	{#if value}
		<button
			type="button"
			class="input-clear"
			aria-label={t.common.clear}
			onclick={() => {
				value = '';
				input.focus();
			}}>×</button
		>
	{/if}
</div>
