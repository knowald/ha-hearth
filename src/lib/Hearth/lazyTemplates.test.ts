import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchTemplateLazily } from './lazyTemplates';

const stop = vi.fn();
const watchTemplate = vi.fn<(template: string, listener: unknown) => () => void>(() => stop);

vi.mock('$lib/core/ha/templates', () => ({ watchTemplate }));

afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe('watchTemplateLazily', () => {
	it('subscribes once the code loads and stops through the returned function', async () => {
		const listener = vi.fn();
		const release = watchTemplateLazily('{{ 1 }}', listener);
		await vi.waitFor(() => expect(watchTemplate).toHaveBeenCalledWith('{{ 1 }}', listener));
		release();
		expect(stop).toHaveBeenCalledTimes(1);
	});

	it('never subscribes when released before the code loads', async () => {
		watchTemplateLazily('{{ 2 }}', vi.fn())();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(watchTemplate).not.toHaveBeenCalled();
	});

	it('holds a delayed template back and drops it when released in the meantime', async () => {
		vi.useFakeTimers();
		const release = watchTemplateLazily('{{ 3 }}', vi.fn(), 400);
		await vi.advanceTimersByTimeAsync(399);
		expect(watchTemplate).not.toHaveBeenCalled();
		release();
		await vi.advanceTimersByTimeAsync(10);
		expect(watchTemplate).not.toHaveBeenCalled();

		watchTemplateLazily('{{ 4 }}', vi.fn(), 400);
		await vi.advanceTimersByTimeAsync(400);
		vi.useRealTimers();
		await vi.waitFor(() => expect(watchTemplate).toHaveBeenCalledTimes(1));
	});
});
