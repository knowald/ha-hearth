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
	it('marks the lines that differ from the document it is compared with', async () => {
		const { container } = render(CodeEditor, {
			type: 'yaml',
			value: 'name: two\n',
			original: 'name: one\n',
			readOnly: true,
			transitionend: false
		});

		await waitFor(() => expect(container.querySelector('.cm-changedLine')).toBeTruthy());
	});

	it('refuses edits when read only', async () => {
		const onchange = vi.fn();
		const { container } = render(CodeEditor, {
			type: 'text',
			value: 'locked',
			readOnly: true,
			transitionend: false,
			onchange
		});
		await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy());

		const view = EditorView.findFromDOM(container.querySelector('.cm-editor')!)!;
		expect(view.state.readOnly).toBe(true);
		expect(container.querySelector('.cm-content')?.getAttribute('contenteditable')).toBe('false');
	});

	it('commits on the save shortcut', async () => {
		const onsave = vi.fn();
		const { container } = render(CodeEditor, {
			type: 'text',
			value: 'draft',
			transitionend: false,
			onsave
		});
		await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy());

		container
			.querySelector('.cm-content')!
			.dispatchEvent(
				new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })
			);

		expect(onsave).toHaveBeenCalled();
	});

	it('keeps the save shortcut away from the page behind it', async () => {
		const onsave = vi.fn();
		const page = vi.fn();
		const { container } = render(CodeEditor, {
			type: 'text',
			value: 'draft',
			transitionend: false,
			onsave
		});
		await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy());

		window.addEventListener('keydown', page);
		try {
			container
				.querySelector('.cm-content')!
				.dispatchEvent(
					new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })
				);
		} finally {
			window.removeEventListener('keydown', page);
		}

		expect(onsave).toHaveBeenCalled();
		// the dashboard's own Ctrl-S writes the file; the editor's applies a draft
		expect(page).not.toHaveBeenCalled();
	});
});
