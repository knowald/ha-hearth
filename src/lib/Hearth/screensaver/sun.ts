import type { HassEntity } from 'home-assistant-js-websocket';

export type SunPhase = 'night' | 'dawn' | 'dusk' | 'day';

export interface SunSky {
	phase: SunPhase;
	/** Gradient colours from the top of the screen to the horizon. */
	top: string;
	middle: string;
	bottom: string;
}

type Rgb = [number, number, number];
/** A sun elevation in degrees and the sky colours at it, top to horizon. */
type SkyStop = [number, Rgb, Rgb, Rgb];

// deep blue at night, warm near the horizon, light blue by day; morning
// leans pink and evening orange, and the two meet once the sun is high
const NIGHT: SkyStop = [-18, [2, 4, 12], [6, 11, 31], [11, 20, 48]];
const DAY: SkyStop[] = [
	[12, [63, 127, 196], [121, 172, 217], [185, 216, 238]],
	[40, [47, 115, 192], [106, 166, 220], [168, 208, 240]]
];
const DAWN: SkyStop[] = [
	NIGHT,
	[-12, [7, 13, 38], [20, 32, 72], [42, 44, 90]],
	[-4, [30, 42, 92], [109, 90, 138], [224, 138, 107]],
	[2, [61, 95, 154], [201, 154, 160], [246, 194, 139]],
	...DAY
];
const DUSK: SkyStop[] = [
	NIGHT,
	[-12, [10, 11, 36], [29, 24, 64], [58, 37, 80]],
	[-4, [31, 29, 79], [122, 74, 114], [231, 118, 74]],
	[2, [52, 80, 138], [199, 122, 116], [245, 158, 87]],
	...DAY
];

// without an elevation attribute the state alone picks a plain day or night
const STATE_ELEVATION: Record<string, number> = { above_horizon: 40, below_horizon: -18 };

function mix(from: Rgb, to: Rgb, amount: number): string {
	const channel = (index: number) => Math.round(from[index] + (to[index] - from[index]) * amount);
	return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
}

function isRising(attributes: Record<string, unknown>): boolean {
	if (typeof attributes.rising === 'boolean') return attributes.rising;
	// the sun climbs from midnight to noon
	const noon = Date.parse(String(attributes.next_noon));
	const midnight = Date.parse(String(attributes.next_midnight));
	return Number.isFinite(noon) && Number.isFinite(midnight) && noon < midnight;
}

/** The sky for a sun entity such as `sun.sun`, or undefined when it says nothing usable. */
export function sunSky(sun: HassEntity | undefined): SunSky | undefined {
	if (!sun) return undefined;
	const attributes = sun.attributes ?? {};
	const elevation =
		typeof attributes.elevation === 'number' && Number.isFinite(attributes.elevation)
			? attributes.elevation
			: STATE_ELEVATION[sun.state];
	if (elevation === undefined) return undefined;
	const rising = isRising(attributes);
	const stops = rising ? DAWN : DUSK;
	const upper = stops.findIndex(([at]) => at >= elevation);
	const [from, to] =
		upper === -1
			? [stops[stops.length - 1], stops[stops.length - 1]]
			: [stops[Math.max(0, upper - 1)], stops[upper]];
	const amount = to[0] === from[0] ? 1 : (elevation - from[0]) / (to[0] - from[0]);
	const clamped = Math.min(1, Math.max(0, amount));
	return {
		phase: elevation < -12 ? 'night' : elevation >= 6 ? 'day' : rising ? 'dawn' : 'dusk',
		top: mix(from[1], to[1], clamped),
		middle: mix(from[2], to[2], clamped),
		bottom: mix(from[3], to[3], clamped)
	};
}
