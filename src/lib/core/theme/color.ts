/*
 * Hex <-> HSV for the colour picker. Themes store hex; the picker works in HSV
 * because that is what a saturation/value square and a hue strip map onto.
 */

export interface Hsv {
	/** Degrees, 0-360. */
	h: number;
	/** Saturation, 0-1. */
	s: number;
	/** Value, 0-1. */
	v: number;
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function clampUnit(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/** Expands shorthand and adds the hash. Null when the text is not a hex colour. */
export function normalizeHex(value: string): string | null {
	const match = HEX.exec(value.trim());
	if (!match) return null;
	const digits = match[1].toLowerCase();
	const full =
		digits.length === 3
			? digits
					.split('')
					.map((digit) => digit + digit)
					.join('')
			: digits;
	return `#${full}`;
}

export function hexToHsv(value: string): Hsv {
	const hex = normalizeHex(value) ?? '#000000';
	const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
	const max = Math.max(r, g, b);
	const span = max - Math.min(r, g, b);

	let h = 0;
	if (span > 0) {
		if (max === r) h = ((g - b) / span) % 6;
		else if (max === g) h = (b - r) / span + 2;
		else h = (r - g) / span + 4;
		h = (h * 60 + 360) % 360;
	}
	return { h, s: max === 0 ? 0 : span / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
	const hue = ((h % 360) + 360) % 360;
	const saturation = clampUnit(s);
	const value = clampUnit(v);
	const chroma = value * saturation;
	const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
	const base = value - chroma;
	const sector = Math.floor(hue / 60);
	const rgb = [
		[chroma, second, 0],
		[second, chroma, 0],
		[0, chroma, second],
		[0, second, chroma],
		[second, 0, chroma],
		[chroma, 0, second]
	][sector];
	return `#${rgb
		.map((channel) =>
			Math.round((channel + base) * 255)
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`;
}

/** The fully saturated colour of a hue, for the picker's own gradients. */
export function hueHex(h: number): string {
	return hsvToHex({ h, s: 1, v: 1 });
}
