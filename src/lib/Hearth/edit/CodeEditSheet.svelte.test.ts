import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import en from '../../../../static/translations/en.json';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import { editor, hearthConfig } from '../store';
import CodeEditSheet from './CodeEditSheet.svelte';

describe('CodeEditSheet', () => {
	beforeEach(() => hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG)));
	afterEach(() => editor.set(null));

	it('names its header action Apply, since it replaces the whole configuration', () => {
		render(CodeEditSheet);
		expect(screen.getByRole('button', { name: en.hearth_apply })).toBeTruthy();
		expect(screen.queryByRole('button', { name: en.done })).toBeNull();
	});

	it('has no back arrow when opened on its own', () => {
		render(CodeEditSheet);
		expect(screen.queryByRole('button', { name: en.back })).toBeNull();
	});

	it('goes back to the sheet it was opened from', async () => {
		render(CodeEditSheet, { from: { kind: 'settings' } });
		await fireEvent.click(screen.getByRole('button', { name: en.back }));
		expect(get(editor)).toEqual({ kind: 'settings' });
	});

	it('hands Versions the draft and its own opener for the trip back', async () => {
		render(CodeEditSheet, { from: { kind: 'settings' }, draft: 'rooms: []\n' });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_versions }));
		expect(get(editor)).toEqual({
			kind: 'versions',
			from: { kind: 'code', draft: 'rooms: []\n', from: { kind: 'settings' } }
		});
	});

	it('announces a document it cannot apply', async () => {
		render(CodeEditSheet, { draft: 'rooms: [' });
		await waitFor(() => expect(screen.getByRole('alert').textContent).not.toBe(''));
	});
});
