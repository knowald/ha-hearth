import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Specs reset the fixture documents by writing them, which the server takes
 * as an outside edit and moves to a new revision. This puts the tracked files
 * back as they were, and forgets the server's written copies so the next run
 * starts from them as they are.
 */
export function restoreFixtures(directory: string) {
	const documents = ['hearth.yaml', 'configuration.yaml'];
	const originals = documents.map((name) => readFileSync(join(directory, name), 'utf8'));
	return () => {
		documents.forEach((name, index) => {
			writeFileSync(join(directory, name), originals[index]);
			rmSync(join(directory, 'backups', `.${name}.written`), { force: true });
		});
	};
}
