import { render } from '@testing-library/svelte';
import type { HassEntities } from 'home-assistant-js-websocket';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { selectedLanguage } from '$lib/core/i18n';
import { presenceChangesAt } from '../../store';
import PresenceStatus from './PresenceStatus.svelte';

const SENSOR = 'binary_sensor.hallway';

function sense(state: string, changedAgoMs: number) {
	states.set({
		[SENSOR]: {
			entity_id: SENSOR,
			state,
			attributes: {},
			last_changed: new Date(Date.now() - changedAgoMs).toISOString()
		}
	} as unknown as HassEntities);
}

const status = (container: HTMLElement) =>
	container.querySelector('.presence-status')?.textContent ?? null;

describe('PresenceStatus', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		selectedLanguage.set('en');
	});

	afterEach(() => {
		vi.useRealTimers();
		states.set({});
		presenceChangesAt.set(undefined);
	});

	it('says someone is around and since when', () => {
		sense('on', 3 * 60_000);
		const { container } = render(PresenceStatus, { entity: SENSOR });
		expect(status(container)).toBe('Now: someone is around, changed 3 minutes ago');
	});

	it("counts down to the screen's change, then says nobody is around", async () => {
		sense('off', 60_000);
		presenceChangesAt.set(Date.now() + 4 * 60_000);
		const { container } = render(PresenceStatus, { entity: SENSOR });
		expect(status(container)).toBe('Now: nobody around, the screen changes in 4 minutes');
		await vi.advanceTimersByTimeAsync(4 * 60_000 + 15_000);
		presenceChangesAt.set(undefined);
		await vi.advanceTimersByTimeAsync(0);
		expect(status(container)).toBe('Now: nobody around, changed 5 minutes ago');
	});

	it('shows a stamp ahead of this clock as now', () => {
		sense('on', -5 * 60_000);
		const { container } = render(PresenceStatus, { entity: SENSOR });
		expect(status(container)).toBe('Now: someone is around, changed now');
	});

	it('says only on and off count for a sensor of another kind', () => {
		sense('21.5', 0);
		const { container } = render(PresenceStatus, { entity: SENSOR });
		expect(status(container)).toBe('Now: 21.5. Only on and off count, so pick a binary sensor');
	});

	it('explains an unavailable sensor and leaves a missing one to the field', () => {
		sense('unavailable', 0);
		const { container } = render(PresenceStatus, { entity: SENSOR });
		expect(status(container)).toBe('Now: the sensor has no reading, so the screen stays as it is');
		const missing = render(PresenceStatus, { entity: 'binary_sensor.gone' });
		expect(status(missing.container)).toBeNull();
	});
});
