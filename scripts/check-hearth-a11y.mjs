import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { compile, preprocess } from 'svelte/compiler';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/* All application components must pass accessibility compilation. */
const ROOTS = ['src/lib/Hearth', 'src/lib/ui', 'src/routes'];

async function* svelteFiles(path) {
	if ((await stat(path)).isFile()) {
		if (path.endsWith('.svelte')) yield path;
		return;
	}
	for (const entry of await readdir(path, { withFileTypes: true })) {
		yield* svelteFiles(join(path, entry.name));
	}
}

let failures = 0;
let count = 0;
for (const root of ROOTS) {
	for await (const filename of svelteFiles(root)) {
		count += 1;
		const source = await readFile(filename, 'utf8');
		const processed = await preprocess(source, vitePreprocess(), { filename });
		const result = compile(processed.code, { filename, generate: false });
		for (const warning of result.warnings.filter(({ code }) => code.startsWith('a11y'))) {
			failures += 1;
			const location = warning.start ? `:${warning.start.line}:${warning.start.column + 1}` : '';
			console.error(`${filename}${location} ${warning.code}: ${warning.message}`);
		}
	}
}

if (failures) {
	console.error(`Accessibility check failed with ${failures} diagnostic(s) in ${count} files.`);
	process.exitCode = 1;
} else {
	console.log(`Accessibility check passed for ${count} components.`);
}
