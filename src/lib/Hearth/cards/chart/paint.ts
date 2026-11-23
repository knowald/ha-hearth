import { styleColor } from '../../visibility';

// a series without a color of its own takes the next role; past the four
// roles the order repeats, faded, so a fifth line is still told apart
const SERIES_ROLES = ['accent', 'cool', 'good', 'bad'];

/** The color series `index` draws in: its own `color` when styleColor reads it, else the next role. */
export function seriesPaint(
	color: string | undefined,
	index: number
): { paint: string; faded: boolean } {
	const own = styleColor(color);
	if (own) return { paint: own, faded: false };
	return {
		paint: styleColor(SERIES_ROLES[index % SERIES_ROLES.length]) ?? '',
		faded: index >= SERIES_ROLES.length
	};
}
