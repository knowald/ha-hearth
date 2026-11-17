/*
 * SVG paths for a line chart drawn into a fixed viewBox. The caller picks
 * both domains, so it can widen them (a climate target, a fixed zero) or
 * place x by time instead of by index. `pad` insets the line from the top
 * and bottom only; x always spans the full width. A null y breaks the line,
 * and every segment gets its own area, closed down to the bottom of the box.
 * Points are drawn in x order; one without a finite x, or outside the x
 * domain, is left out, and a non-finite y breaks the line like a null.
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
	/** Points that are a segment on their own: the line draws nothing there, so the caller marks them. */
	singles: { x: number; y: number }[];
}

// the shortest form of a number as the path writes it to one decimal: "300", "66.7"
function shortest(value: number): string {
	return String(Number(value.toFixed(1)));
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
	const singles: { x: number; y: number }[] = [];
	const [low, high] = [Math.min(...domain.x), Math.max(...domain.x)];
	// a stable sort, so a gap keeps its place among points of the same x
	const placed = points
		.filter((point) => Number.isFinite(point.x) && point.x >= low && point.x <= high)
		.sort((a, b) => a.x - b.x);
	let line = '';
	let area = '';
	let segment = '';
	let length = 0;
	let first = 0;
	// a trailing gap closes the last segment like any other
	for (const point of [...placed, { x: 0, y: null }]) {
		if (point.y === null || !Number.isFinite(point.y)) {
			if (segment) {
				// line points keep one decimal ("300.0"); the closing corners are
				// written the shortest way ("300"), the format the charts always used
				const last = coords[coords.length - 1];
				line += ` ${segment}`;
				area += ` ${segment} L${shortest(last.x)},${box.height} L${shortest(first)},${box.height} Z`;
				if (length === 1) singles.push(last);
			}
			segment = '';
			length = 0;
			continue;
		}
		const x = fraction(point.x, domain.x) * box.width;
		const y = chartY(point.y, box, domain.y);
		coords.push({ x, y });
		if (!segment) first = x;
		segment += `${segment ? ' L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
		length += 1;
	}
	return { line: line.trim(), area: area.trim(), coords, singles };
}
