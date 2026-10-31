import { act, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectedLanguage } from '$lib/core/i18n';
import { states } from '$lib/core/ha/entities';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig, type RailWidget } from '../config';
import { openEntityDetail } from '../details';
import { hearthConfig } from '../store';
import PhoneHeader from './PhoneHeader.svelte';

vi.mock('../details', () => ({ openEntityDetail: vi.fn() }));

function configure(rail: RailWidget[], settings: Partial<HearthConfig> = {}) {
	hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), ...settings, rail });
}

const clock = { id: 'clock', type: 'clock', timezone: 'UTC', hour_format: '24' } as RailWidget;
const weather = { id: 'weather', type: 'weather', entity: 'weather.home' } as RailWidget;

describe('PhoneHeader', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-03-05T17:04:00Z') });
		selectedLanguage.set('en-US');
		states.set({
			'weather.home': {
				entity_id: 'weather.home',
				state: 'partlycloudy',
				attributes: { temperature: 21.6 }
			}
		} as never);
	});

	afterEach(() => {
		vi.useRealTimers();
		selectedLanguage.set(undefined as never);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		states.set({});
	});

	it('shows the time, a short date and the current weather in one row', async () => {
		configure([clock, weather]);
		render(PhoneHeader);
		const time = document.querySelector('time');
		expect(time?.textContent).toContain('17:04');
		expect(time?.textContent).toContain('Thu, Mar 5');

		const reading = screen.getByRole('button', { name: 'Partly cloudy, 22\u00b0' });
		expect(reading.textContent).toContain('22\u00b0');
		await fireEvent.click(reading);
		expect(openEntityDetail).toHaveBeenCalledWith('weather.home');
	});

	it('steps aside for widgets placed above the page by hand', async () => {
		configure([
			{ ...clock, mobile: 'top' },
			{ ...weather, mobile: 'top' }
		]);
		const { container } = render(PhoneHeader);
		expect(container.querySelector('.phone-header')).toBeNull();

		await act(() => configure([{ ...clock, mobile: 'top' }, weather]));
		expect(document.querySelector('time')).toBeNull();
		expect(screen.getByRole('button', { name: 'Partly cloudy, 22\u00b0' })).toBeTruthy();
	});

	it('keeps the time without a weather widget, and says when the weather is unavailable', async () => {
		configure([]);
		render(PhoneHeader);
		expect(document.querySelector('time')).not.toBeNull();
		expect(screen.queryByRole('button')).toBeNull();

		await act(() => {
			configure([weather]);
			states.set({
				'weather.home': { entity_id: 'weather.home', state: 'unavailable', attributes: {} }
			} as never);
		});
		expect(screen.getByRole('button', { name: 'Unavailable' }).textContent).toContain('-');
	});
});
