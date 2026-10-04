import { describe, expect, it, vi } from 'vitest';
import { watchTemplateLazily } from './lazyTemplates';

const stop = vi.fn();
const watchTemplate = vi.fn<(template: string, listener: unknown) => () => void>(() => stop);

vi.mock('$lib/core/ha/templates', () => ({ watchTemplate }));

describe('watchTemplateLazily', () => {
	it('subscribes once the code loads and stops through the returned function', async () => {
		const listener = vi.fn();
		const release = watchTemplateLazily('{{ 1 }}', listener);
		await vi.waitFor(() => expect(watchTemplate).toHaveBeenCalledWith('{{ 1 }}', listener));
		release();
		expect(stop).toHaveBeenCalledTimes(1);
	});

	it('never subscribes when released before the code loads', async () => {
		watchTemplate.mockClear();
		watchTemplateLazily('{{ 2 }}', vi.fn())();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(watchTemplate).not.toHaveBeenCalled();
	});
});
