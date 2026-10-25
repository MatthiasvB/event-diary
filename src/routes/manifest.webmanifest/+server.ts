import { config } from '#lib/server/config.ts';
import { locale } from '#lib/i18n.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	Response.json(
		{
			name: config.appName,
			short_name: config.appName,
			lang: locale,
			start_url: '/',
			scope: '/',
			display: 'standalone',
			background_color: '#f5f6f2',
			theme_color: '#2e7a4d',
			icons: [
				{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
				{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
				{ src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
				{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }
			]
		},
		{ headers: { 'content-type': 'application/manifest+json' } }
	);
