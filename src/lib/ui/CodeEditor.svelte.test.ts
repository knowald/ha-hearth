import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
import CodeEditor from './CodeEditor.svelte';

/**
 * CodeMirror throws on an unrecognized extension, so mounting at all proves
 * every extension in the set resolved - including the ones that come from the
 * `codemirror` meta-package rather than a `@codemirror/*` scoped one.
 */
describe('CodeEditor', () => {
	it('mounts a CodeMirror view showing the value', async () => {
		const { container } = render(CodeEditor, {
			type: 'text',
			value: 'alias: porch light',
			transitionend: false
		});

		await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy());
		expect(container.querySelector('.cm-content')?.textContent).toBe('alias: porch light');
		// line numbers arrive with basicSetup, nothing else in the set adds them
		expect(container.querySelector('.cm-lineNumbers')).toBeTruthy();
	});

	it('loads the yaml mode and its lint gutter', async () => {
		const { container } = render(CodeEditor, {
			type: 'yaml',
			value: 'alias: porch light',
			transitionend: false
		});

		await waitFor(() => expect(container.querySelector('.cm-gutter-lint')).toBeTruthy());
	});

	it('reports edits through onchange', async () => {
		const onchange = vi.fn();
		const { container } = render(CodeEditor, {
			type: 'text',
			value: 'on',
			transitionend: false,
			onchange
		});
		await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy());

		onchange.mockClear();
		const view = EditorView.findFromDOM(container.querySelector('.cm-editor')!)!;
		view.dispatch({ changes: { from: view.state.doc.length, insert: 'ce' } });

		expect(onchange).toHaveBeenCalledWith('once');
	});

	it('tears the view down when unmounted', async () => {
		const { container, unmount } = render(CodeEditor, {
			type: 'text',
			value: 'alias: porch light',
			transitionend: false
		});
		await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy());

		unmount();
		expect(container.querySelector('.cm-editor')).toBeNull();
	});
});
