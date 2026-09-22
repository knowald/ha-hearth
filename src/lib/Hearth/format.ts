import { isRecord } from './normalizers';

/** First standalone document format. Earlier experimental formats are unsupported. */
export const CONFIG_VERSION = 5;

export function configVersion(raw: unknown): number | undefined {
	return isRecord(raw) && Number.isInteger(raw.version) ? (raw.version as number) : undefined;
}

/** Editor drafts omit the server-owned version; persisted files must declare it. */
export function currentHearthConfig(raw: unknown): unknown {
	if (!isRecord(raw)) return raw;
	if (raw.version !== undefined && raw.version !== CONFIG_VERSION) {
		throw new Error(
			`Unsupported Hearth configuration version ${String(raw.version)}; expected ${CONFIG_VERSION}`
		);
	}
	return raw;
}

/**
 * One number format for every reading: whole values bare, anything else to
 * one decimal (or `decimals`, for entities with a finer step), "-" when
 * there is none. Degrees and percent bind to the number ("21.5°C", "40%");
 * other units follow a space ("3.2 kWh").
 */
export function formatReading(value: number | null | undefined, unit = '', decimals = 1): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '-';
	const scale = 10 ** decimals;
	const rounded = Math.round(value * scale) / scale;
	const number = Number.isInteger(rounded)
		? String(rounded)
		: String(Number(rounded.toFixed(decimals)));
	if (!unit) return number;
	return unit === '%' || unit.startsWith('°') ? `${number}${unit}` : `${number} ${unit}`;
}

/** Decimal places a step needs, at least one: 0.05 needs two. */
export function stepDecimals(step: number): number {
	const fraction = String(step).split('.')[1] ?? '';
	return Math.max(1, fraction.length);
}
