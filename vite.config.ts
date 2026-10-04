import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
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
const CLIENT_APP = resolve(import.meta.dirname, '.svelte-kit/generated/client-optimized/app.js');
const EAGER_ROOTS = [
	CLIENT_APP,
	resolve(import.meta.dirname, 'src/routes/+layout.svelte'),
	resolve(import.meta.dirname, 'src/routes/+page.svelte')
];

interface ChunkingContext {
	getModuleInfo(id: string): { importedIds: readonly string[] } | null;
}

// one chunking pass per build
const eagerClosures = new WeakMap<ChunkingContext, Set<string>>();

function eagerModules(context: ChunkingContext): Set<string> {
	let modules = eagerClosures.get(context);
	if (modules) return modules;
	// a SvelteKit upgrade that moves the entry would otherwise quietly undo the grouping
	if (!context.getModuleInfo(CLIENT_APP)) {
		throw new Error(`eager chunk: the SvelteKit client entry ${CLIENT_APP} is not in the build`);
	}
	modules = new Set();
	const pending = [...EAGER_ROOTS];
	while (pending.length) {
		const id = pending.pop()!;
		const info = modules.has(id) ? null : context.getModuleInfo(id);
		if (!info) continue;
		modules.add(id);
		pending.push(...info.importedIds);
	}
	eagerClosures.set(context, modules);
	return modules;
}

// SvelteKit runs the client build as a second build with its own copy of this config
function eagerChunk(): Plugin {
	let ssr = true;
	return {
		name: 'hearth-eager-chunk',
		apply: 'build',
		configResolved(config) {
			ssr = Boolean(config.build.ssr);
		},
		outputOptions(options) {
			if (ssr) return;
			return {
				...options,
				codeSplitting: {
					groups: [
						{
							name: (id: string, context: ChunkingContext) =>
								eagerModules(context).has(id) ? 'eager' : null
						}
					]
				}
			};
		}
	};
}

export default defineConfig({
	plugins: [sveltekit(), eagerChunk()],
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
