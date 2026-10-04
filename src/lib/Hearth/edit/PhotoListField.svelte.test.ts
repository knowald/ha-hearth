import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PhotoListField from './PhotoListField.svelte';

const FIRST = `hearth-images/${'a'.repeat(32)}.webp`;
const SECOND = `hearth-images/${'b'.repeat(32)}.webp`;

function file(name: string) {
	return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
}

describe('PhotoListField', () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		let upload = 0;
		fetchMock = vi.fn(async () => {
			upload += 1;
			if (upload === 2) {
				return { ok: false, status: 400, json: async () => ({ message: 'unsupported' }) };
			}
			const name = ['a', '', 'b', 'c'][upload - 1];
			return { ok: true, json: async () => ({ file: `${name.repeat(32)}.webp`, size: 3 }) };
		});
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => vi.unstubAllGlobals());

	it('uploads several files one after another and appends the ones that worked', async () => {
		const onchange = vi.fn();
		const { container } = render(PhotoListField, { label: 'Photos', value: [FIRST], onchange });
		const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
		expect(input.multiple).toBe(true);
		await fireEvent.change(input, {
			target: { files: [file('one.png'), file('two.png'), file('three.png'), file('four.png')] }
		});

		// the first upload is already in the list, so it is not added twice
		await waitFor(() =>
			expect(onchange).toHaveBeenCalledWith([FIRST, SECOND, `hearth-images/${'c'.repeat(32)}.webp`])
		);
		expect(fetchMock).toHaveBeenCalledTimes(4);
		expect(screen.getByRole('alert').textContent).toBe('Could not upload 1 of the photos');
	});

	it('removes a photo from the list', async () => {
		const onchange = vi.fn();
		render(PhotoListField, { label: 'Photos', value: [FIRST, SECOND], onchange });
		await fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }));
		expect(onchange).toHaveBeenCalledWith([SECOND]);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
