import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export default defineConfig({
	plugins: [sveltekit()],
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
