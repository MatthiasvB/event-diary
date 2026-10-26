<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { isoDate } from '#lib/format.ts';
	import { t } from '#lib/i18n.ts';
	import { leaveFormOnRedirect } from '#lib/leaveForm.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const leave = leaveFormOnRedirect();
	const keepInput =
		() =>
		async ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) =>
			update({ reset: false });

	const owner = $derived(data.diary.role === 'owner');
	// The link is only in the response that created it.
	const inviteUrl = $derived(form?.invite ? new URL(form.invite.path, page.url.origin).href : '');
	let copied = $state(false);
	let canShare = $state(false);
	onMount(() => (canShare = 'share' in navigator));

	async function copy() {
		await navigator.clipboard.writeText(inviteUrl);
		copied = true;
	}
	function share() {
		navigator.share({ title: t.diary.shareText(data.diary.name), url: inviteUrl }).catch(() => {});
	}
</script>

<svelte:head><title>{t.diary.title} · {data.diary.name}</title></svelte:head>

<h1>{data.diary.name}</h1>

{#if owner}
	<form method="POST" action="?/rename" class="row bottom" use:enhance={keepInput}>
		<label class="grow">
			{t.diary.name}
			<input name="name" value={data.diary.name} required />
		</label>
		<button>{t.common.save}</button>
	</form>
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	{#if form?.message}<p class="notice">{form.message}</p>{/if}
{:else}
	<p class="muted">{t.diary.yourRole(t.diary.roles[data.diary.role])}</p>
{/if}

{#if data.sharing}
	{#if owner}
		<h2>{t.diary.share}</h2>
		<p class="muted small">{t.diary.shareHint}</p>
		<form
			method="POST"
			action="?/invite"
			class="row bottom"
			use:enhance={() => {
				copied = false;
				return keepInput();
			}}
		>
			<label class="grow">
				{t.diary.role}
				<select name="role">
					<option value="editor">{t.diary.roles.editor}</option>
					<option value="viewer">{t.diary.roles.viewer}</option>
				</select>
			</label>
			<button class="primary">{t.diary.createInvite}</button>
		</form>
		{#if inviteUrl}
			<div class="card stack invite">
				<span class="small">{t.diary.inviteCreated}</span>
				<input readonly value={inviteUrl} onfocus={(e) => e.currentTarget.select()} />
				<div class="row">
					<button type="button" class="small" onclick={copy}
						>{copied ? `✓ ${t.diary.copied}` : t.diary.copy}</button
					>
					{#if canShare}
						<button type="button" class="small" onclick={share}>{t.diary.shareLink}</button>
					{/if}
				</div>
			</div>
		{/if}
		{#if data.invites.length}
			<h3>{t.diary.openInvites}</h3>
			<ul class="stack list">
				{#each data.invites as invite (invite.id)}
					<li class="card spread">
						<span class="small"
							>{t.diary.inviteLine(
								t.diary.roles[invite.role],
								isoDate(new Date(invite.expiresAt))
							)}</span
						>
						<form method="POST" action="?/revoke" use:enhance>
							<input type="hidden" name="invite" value={invite.id} />
							<button class="small">{t.diary.revoke}</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	<h2>{t.diary.members}</h2>
	<ul class="stack list">
		{#each data.members as m (m.username)}
			<li class="card spread">
				<span>
					{m.username}
					{#if m.username === data.user}<span class="muted small">({t.diary.you})</span>{/if}
				</span>
				{#if owner && m.role !== 'owner'}
					<div class="row">
						<form method="POST" action="?/setRole" use:enhance>
							<input type="hidden" name="username" value={m.username} />
							<select
								name="role"
								class="small"
								value={m.role}
								aria-label={t.diary.role}
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
							>
								<option value="editor">{t.diary.roles.editor}</option>
								<option value="viewer">{t.diary.roles.viewer}</option>
							</select>
						</form>
						<form
							method="POST"
							action="?/remove"
							use:enhance={({ cancel }) => {
								if (!confirm(t.diary.confirmRemove(m.username))) cancel();
							}}
						>
							<input type="hidden" name="username" value={m.username} />
							<button class="small danger">{t.diary.remove}</button>
						</form>
					</div>
				{:else}
					<span class="muted small">{t.diary.roles[m.role]}</span>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

{#if owner && data.contents}
	{@const contents = data.contents}
	<form
		method="POST"
		action="?/delete"
		class="danger-zone stack"
		use:enhance={({ cancel }) => {
			if (!confirm(t.diary.confirmDelete(data.diary.name, contents))) cancel();
			return leave;
		}}
	>
		<p class="muted small">{t.diary.deleteHint}</p>
		<div><button class="danger">{t.diary.delete}</button></div>
	</form>
{:else if !owner}
	<form
		method="POST"
		action="/?/leave"
		class="danger-zone"
		use:enhance={({ cancel }) => {
			if (!confirm(t.diary.confirmLeave(data.diary.name))) cancel();
			return leave;
		}}
	>
		<input type="hidden" name="diary" value={data.diary.id} />
		<button class="danger">{t.diary.leave}</button>
	</form>
{/if}

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		gap: 0.4rem;
	}
	.invite {
		margin-top: 0.75rem;
		gap: 0.5rem;
	}
	h3 {
		margin: 1.25rem 0 0.5rem;
		font-size: 1rem;
	}
	select.small {
		width: auto;
	}
	.danger-zone {
		margin-top: 2.5rem;
	}
	p {
		margin: 0;
	}
	h2 + p {
		margin-bottom: 0.75rem;
	}
</style>
