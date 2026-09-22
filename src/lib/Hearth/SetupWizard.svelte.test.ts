import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from 'home-assistant-js-websocket';
import { connection } from '$lib/core/ha/connection';
import { fetchRegistry } from '$lib/core/ha/registry';
import en from '../../../static/translations/en.json';
import SetupWizard from './SetupWizard.svelte';

vi.mock('$lib/core/ha/registry', () => ({ fetchRegistry: vi.fn() }));

function backdrop(container: HTMLElement) {
	return container.querySelector('.overlay') as HTMLElement;
}

describe('SetupWizard', () => {
	beforeEach(() => {
		connection.set({} as Connection);
		vi.mocked(fetchRegistry).mockReturnValue(new Promise(() => {}));
	});
	afterEach(() => connection.set(undefined));

	it('ignores a backdrop tap on first run and offers to skip instead of cancel', async () => {
		const onclose = vi.fn();
		const { container } = render(SetupWizard, { onclose, firstRun: true });
		await fireEvent.pointerDown(backdrop(container));
		expect(onclose).not.toHaveBeenCalled();
		expect(screen.queryByRole('button', { name: en.cancel })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_skip_for_now }));
		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('closes on a backdrop tap when opened on purpose', async () => {
		const onclose = vi.fn();
		const { container } = render(SetupWizard, { onclose });
		await fireEvent.pointerDown(backdrop(container));
		expect(onclose).toHaveBeenCalledTimes(1);
		expect(screen.getByRole('button', { name: en.cancel })).toBeTruthy();
	});

	it('announces loading as a status', () => {
		render(SetupWizard, { onclose: vi.fn() });
		expect(screen.getByRole('status').textContent).toContain(en.hearth_loading_registries);
	});

	it('reports a failed registry fetch as a translated alert with the detail beneath', async () => {
		vi.mocked(fetchRegistry).mockRejectedValue(new Error('timeout'));
		render(SetupWizard, { onclose: vi.fn() });
		const alert = await screen.findByRole('alert');
		expect(alert.querySelector('strong')?.textContent).toBe(en.hearth_registries_failed);
		expect(alert.textContent).toContain('timeout');
	});
});
