import type { HassEntity } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';
import { sunSky } from './sun';

function sun(attributes: Record<string, unknown>, state = 'above_horizon'): HassEntity {
	return { entity_id: 'sun.sun', state, attributes } as unknown as HassEntity;
}

// the blue channel's lead over red: high for a blue sky, low or negative for a warm one
function blueness(color: string) {
	const [red, , blue] = color.match(/\d+/g)!.map(Number);
	return blue - red;
}

describe('sunSky', () => {
	it('is deep blue at night', () => {
		const sky = sunSky(sun({ elevation: -40, rising: false }, 'below_horizon'))!;
		expect(sky.phase).toBe('night');
		expect(sky).toMatchObject({ top: 'rgb(2 4 12)', bottom: 'rgb(11 20 48)' });
	});

	it('glows warm at the horizon around dawn and dusk', () => {
		const dawn = sunSky(sun({ elevation: -1, rising: true }, 'below_horizon'))!;
		const dusk = sunSky(sun({ elevation: -1, rising: false }, 'below_horizon'))!;
		expect(dawn.phase).toBe('dawn');
		expect(dusk.phase).toBe('dusk');
		expect(blueness(dawn.bottom)).toBeLessThan(0);
		expect(blueness(dusk.bottom)).toBeLessThan(0);
		expect(dawn.bottom).not.toBe(dusk.bottom);
	});

	it('is light blue by day and the same whichever way the sun moves', () => {
		const morning = sunSky(sun({ elevation: 45, rising: true }))!;
		const afternoon = sunSky(sun({ elevation: 45, rising: false }))!;
		expect(morning.phase).toBe('day');
		expect(morning).toEqual(afternoon);
		expect(blueness(morning.top)).toBeGreaterThan(100);
		expect(blueness(morning.bottom)).toBeGreaterThan(0);
	});

	it('blends between stops as the sun climbs', () => {
		const low = sunSky(sun({ elevation: 2, rising: true }))!;
		const middle = sunSky(sun({ elevation: 7, rising: true }))!;
		const high = sunSky(sun({ elevation: 12, rising: true }))!;
		expect(blueness(middle.bottom)).toBeGreaterThan(blueness(low.bottom));
		expect(blueness(middle.bottom)).toBeLessThan(blueness(high.bottom));
	});

	it('tells morning from evening by the next noon without the rising attribute', () => {
		const morning = sunSky(
			sun({
				elevation: -2,
				next_noon: '2026-10-04T11:00:00Z',
				next_midnight: '2026-10-04T23:00:00Z'
			})
		)!;
		expect(morning.phase).toBe('dawn');
		const evening = sunSky(
			sun({
				elevation: -2,
				next_noon: '2026-10-05T11:00:00Z',
				next_midnight: '2026-10-04T23:00:00Z'
			})
		)!;
		expect(evening.phase).toBe('dusk');
	});

	it('falls back to the state alone without an elevation', () => {
		expect(sunSky(sun({}, 'above_horizon'))?.phase).toBe('day');
		expect(sunSky(sun({}, 'below_horizon'))?.phase).toBe('night');
	});

	it('has nothing to show for a missing or unavailable sun', () => {
		expect(sunSky(undefined)).toBeUndefined();
		expect(sunSky(sun({}, 'unavailable'))).toBeUndefined();
	});
});
