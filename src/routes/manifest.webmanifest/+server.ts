import { config } from '#lib/server/config.ts';
import { locale } from '#lib/i18n.ts';
import { SHARE_PATH } from '#lib/share.ts';
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
			// Android: appear in the share sheet for photos and videos (handled by the service
			// worker). Installed apps pick up changes here only when Chrome updates them.
			share_target: {
				action: SHARE_PATH,
				method: 'POST',
				enctype: 'multipart/form-data',
				params: { files: [{ name: 'photos', accept: ['image/*', 'video/*'] }] }
			},
			icons: [
				{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
				{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
				{ src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
				{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }
			]
		},
		{ headers: { 'content-type': 'application/manifest+json' } }
	);
