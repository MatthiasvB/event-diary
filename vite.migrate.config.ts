import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		ssr: 'src/lib/server/migrate.ts',
		outDir: 'build/migrate',
		emptyOutDir: true,
		target: 'node24'
	},
	ssr: { noExternal: true }
});
