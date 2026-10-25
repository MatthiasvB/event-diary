<script lang="ts">
	import '../app.css';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { t } from '#lib/i18n.ts';
	import { startPhotoEvent } from '#lib/pending.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	type NavItem = {
		href: '/' | '/events' | '/events/new' | '/more';
		label: string;
		icon: string;
		primary?: boolean;
	};
	const items: NavItem[] = [
		{
			href: '/',
			label: t.nav.plants,
			icon: 'M12 21v-8m0 0c0-4 3-7 7-7 0 4-3 7-7 7Zm0 0c0-3-2.5-5.5-6-5.5 0 3.5 2.5 5.5 6 5.5Z'
		},
		{ href: '/events', label: t.nav.events, icon: 'M4 6h16M4 12h16M4 18h10' },
		{ href: '/events/new', label: t.nav.add, icon: 'M12 5v14M5 12h14', primary: true },
		{ href: '/more', label: t.nav.more, icon: 'M5 12h.01M12 12h.01M19 12h.01' }
	];

	const showNav = $derived(page.url.pathname !== '/login');

	function isCurrent(href: string) {
		const path = page.url.pathname;
		if (href === '/') return path === '/' || path.startsWith('/plants');
		if (href === '/events') return path.startsWith('/events') && !path.startsWith('/events/new');
		if (href === '/more')
			return ['/more', '/types', '/maintenance', '/settings'].some((p) => path.startsWith(p));
		return path === href;
	}
</script>

<svelte:head>
	<title>{data.appName}</title>
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="icon" href="/icon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content={data.appName} />
	<meta name="theme-color" content="#2e7a4d" />
</svelte:head>

{#if showNav}
	<nav class="nav" aria-label="Hauptnavigation">
		<a class="brand" href={resolve('/')}>{data.appName}</a>
		{#each items as item (item.href)}
			<a
				href={resolve(item.href)}
				class:primary={item.primary}
				aria-current={isCurrent(item.href) ? 'page' : undefined}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d={item.icon} /></svg>
				<span>{item.label}</span>
			</a>
			{#if item.primary}
				<label class="camera">
					<input
						type="file"
						accept="image/*"
						capture="environment"
						class="visually-hidden"
						onchange={(e) => startPhotoEvent(e)}
					/>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M4 8h3l2-3h6l2 3h3v11H4z" />
						<circle cx="12" cy="13" r="3.5" />
					</svg>
					<span>{t.nav.photo}</span>
				</label>
			{/if}
		{/each}
	</nav>
{/if}

<main class="content">
	{@render children()}
</main>

<style>
	.content {
		max-width: 960px;
		margin: 0 auto;
		padding: 1rem 1rem calc(var(--nav-height) + env(safe-area-inset-bottom) + 1.5rem);
	}

	.nav {
		position: fixed;
		z-index: 10;
		inset: auto 0 0 0;
		height: calc(var(--nav-height) + env(safe-area-inset-bottom));
		padding-bottom: env(safe-area-inset-bottom);
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		background: var(--surface);
		border-top: 1px solid var(--border);
	}
	.nav .brand {
		display: none;
	}
	.nav a,
	.camera {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		font-size: 0.75rem;
		color: var(--muted);
		text-decoration: none;
		cursor: pointer;
	}
	.nav a[aria-current='page'] {
		color: var(--accent);
		font-weight: 600;
	}
	.nav svg {
		width: 24px;
		height: 24px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.nav a.primary svg {
		width: 40px;
		height: 40px;
		padding: 8px;
		border-radius: 50%;
		background: var(--accent);
		color: var(--accent-text);
		stroke-width: 2.5;
	}
	.nav a.primary span {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.camera:focus-within {
		outline: 2px solid var(--accent);
	}

	@media (min-width: 900px) {
		.nav {
			position: sticky;
			top: 0;
			height: auto;
			padding: 0.5rem 1rem;
			display: flex;
			gap: 1.25rem;
			align-items: center;
			border-top: none;
			border-bottom: 1px solid var(--border);
		}
		.nav .brand {
			display: block;
			font-weight: 700;
			color: var(--text) !important;
			margin-right: auto;
			font-size: 1.05rem !important;
		}
		.nav a,
		.camera {
			flex-direction: row;
			font-size: 0.95rem;
			gap: 0.4rem;
		}
		.nav svg {
			width: 20px;
			height: 20px;
		}
		.nav a.primary {
			order: 10;
			background: var(--accent);
			color: var(--accent-text);
			padding: 0.45rem 0.9rem;
			border-radius: 10px;
			font-weight: 600;
		}
		.nav a.primary svg {
			width: 20px;
			height: 20px;
			padding: 0;
			background: none;
			color: inherit;
		}
		.nav a.primary span {
			position: static;
			width: auto;
			height: auto;
			clip-path: none;
		}
	}
</style>
