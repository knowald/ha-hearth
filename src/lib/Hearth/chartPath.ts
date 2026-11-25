/*
 * SVG paths for a line chart drawn into a fixed viewBox. The caller picks
 * both domains, so it can widen them (a climate target, a fixed zero) or
 * place x by time instead of by index. `pad` insets the line from the top
 * and bottom only; x always spans the full width. A null y breaks the line,
 * and every segment gets its own area, closed down to the bottom of the box.
 */

export interface ChartBox {
	width: number;
	height: number;
	pad: number;
}

export interface ChartDomain {
	x: [number, number];
	y: [number, number];
}

export interface SeriesPath {
	line: string;
	area: string;
	/** The drawn points in viewBox units, gaps left out. */
	coords: { x: number; y: number }[];
}

// a flat domain divides by 1 instead of 0: every point lands on the low edge
function fraction(value: number, [low, high]: [number, number]): number {
	return (value - low) / (high - low || 1);
}

export function chartY(value: number, box: ChartBox, domain: [number, number]): number {
	return box.pad + (1 - fraction(value, domain)) * (box.height - 2 * box.pad);
}

export function seriesPath(
	points: { x: number; y: number | null }[],
	box: ChartBox,
	domain: ChartDomain
): SeriesPath {
	const coords: { x: number; y: number }[] = [];
	let line = '';
	let area = '';
	let segment = '';
	let first = 0;
	// a trailing gap closes the last segment like any other
	for (const point of [...points, { x: 0, y: null }]) {
		if (point.y === null) {
			if (segment) {
				// line points keep one decimal ("300.0"); the closing corners are
				// written the shortest way ("300"), the format the charts always used
				const corner = (x: number) => Math.round(x * 10) / 10;
				line += ` ${segment}`;
				area += ` ${segment} L${corner(coords[coords.length - 1].x)},${box.height} L${corner(first)},${box.height} Z`;
			}
			segment = '';
			continue;
		}
		const x = fraction(point.x, domain.x) * box.width;
		const y = chartY(point.y, box, domain.y);
		coords.push({ x, y });
		if (!segment) first = x;
		segment += `${segment ? ' L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
	}
	return { line: line.trim(), area: area.trim(), coords };
}
