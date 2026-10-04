import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText, readClipboard } from './clipboard';

describe('copyText', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		delete (document as { execCommand?: unknown }).execCommand;
	});

	it('uses the Clipboard API where there is one', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		expect(await copyText('type: clock')).toBe(true);
		expect(writeText).toHaveBeenCalledWith('type: clock');
	});

	it('falls back to the copy command when the API refuses', async () => {
		vi.stubGlobal('navigator', {
			clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) }
		});
		const execCommand = vi.fn().mockReturnValue(true);
		document.execCommand = execCommand;
		expect(await copyText('type: clock')).toBe(true);
		expect(execCommand).toHaveBeenCalledWith('copy');
		expect(document.querySelector('textarea')).toBeNull();
	});

	it('reports failure in an insecure context the copy command also refuses', async () => {
		vi.stubGlobal('navigator', {});
		document.execCommand = vi.fn().mockReturnValue(false);
		expect(await copyText('type: clock')).toBe(false);
	});
});

describe('readClipboard', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('reads the text, or nothing where the page may not', async () => {
		vi.stubGlobal('navigator', { clipboard: { readText: vi.fn().mockResolvedValue('a: 1') } });
		expect(await readClipboard()).toBe('a: 1');
		vi.stubGlobal('navigator', { clipboard: { readText: vi.fn().mockRejectedValue(new Error()) } });
		expect(await readClipboard()).toBeUndefined();
		vi.stubGlobal('navigator', {});
		expect(await readClipboard()).toBeUndefined();
	});
});
