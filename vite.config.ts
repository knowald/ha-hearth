import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ quiet: true });

/*
 * The dashboard route's eager code goes out as one chunk. Left to itself the
 * bundler splits it into dozens of small shared chunks, and each one pays for
 * its own import and export names and its own gzip dictionary, about 15% of
 * the gzipped total. Code behind a dynamic import() keeps its own chunks; it
 * imports from this one, which is already loaded by then.
 */
const EAGER_ROOTS = [
	'.svelte-kit/generated/client-optimized/app.js',
	'src/routes/+layout.svelte',
	'src/routes/+page.svelte'
].map((path) => resolve(path));

interface ChunkingContext {
	getModuleInfo(id: string): { importedIds: readonly string[] } | null;
}

// one chunking pass per build; the server build has no client app entry and gets no group
const eagerClosures = new WeakMap<ChunkingContext, Set<string>>();

function eagerModules(context: ChunkingContext): Set<string> {
	let modules = eagerClosures.get(context);
	if (modules) return modules;
	modules = new Set();
	if (context.getModuleInfo(EAGER_ROOTS[0])) {
		const pending = [...EAGER_ROOTS];
		while (pending.length) {
			const id = pending.pop()!;
			const info = modules.has(id) ? null : context.getModuleInfo(id);
			if (!info) continue;
			modules.add(id);
			pending.push(...info.importedIds);
		}
	}
	eagerClosures.set(context, modules);
	return modules;
}

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		rolldownOptions: {
			output: {
				codeSplitting: {
					groups: [
						{
							name: (id: string, context: ChunkingContext) =>
								eagerModules(context).has(id) ? 'eager' : null
						}
					]
				}
			}
		}
	},
	optimizeDeps: {
		include: [
			// include all because of dynamic imports, prevents: ✨ optimized dependencies changed. reloading
			'd3-array',
			'd3-scale',
			'd3-shape',
			'dompurify',
			'dotenv',
			'express',
			'hls.js',
			'home-assistant-js-websocket',
			'http-proxy-middleware',
			'js-yaml',
			'marked',
			'sortablejs'
		],
		exclude: [
			// exclude codemirror to avoid state duplication
			'@codemirror/autocomplete',
			'@codemirror/commands',
			'@codemirror/language',
			'@codemirror/legacy-modes',
			'@codemirror/lint',
			'@codemirror/merge',
			'@codemirror/state',
			'@codemirror/theme-one-dark',
			'@codemirror/view',
			'codemirror'
		]
	},
	server: {
		// required for webrtc
		host: true,
		// development proxy endpoints
		proxy: {
			'/local/': {
				target: process.env.HASS_URL,
				changeOrigin: true
			},
			'/api/': {
				target: process.env.HASS_URL,
				changeOrigin: true
			}
		}
	}
});
