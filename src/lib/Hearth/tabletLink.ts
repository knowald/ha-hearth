/*
 * The address a wall tablet opens the dashboard at, and the QR code for it.
 */

/** Ingress serves the app under /api/hassio_ingress/<token>/, see core/ha/connection.ts. */
export function isIngressPath(pathname: string): boolean {
	return pathname.includes('/api/hassio_ingress/');
}

/**
 * The address the tablet can open directly, or undefined under Ingress: an
 * Ingress address is tied to a Home Assistant session and only works inside
 * its frontend, so the app's own port has to be entered instead.
 */
export function directAddress(location: Pick<Location, 'origin' | 'pathname'>, base: string) {
	if (isIngressPath(location.pathname)) return undefined;
	return `${location.origin}${base}/`;
}

/**
 * The dashboard address with the device name the tablet should answer to, or
 * undefined for anything that is not an http(s) address.
 */
export function tabletUrl(address: string, device = ''): string | undefined {
	let url: URL;
	try {
		url = new URL(address.trim());
	} catch {
		return undefined;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
	const name = device.trim();
	if (name) url.searchParams.set('device', name);
	else url.searchParams.delete('device');
	return url.href;
}

/** One SVG path drawing every dark module, one unit per module. */
export function qrPath(modules: boolean[][]): string {
	return modules
		.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : [])))
		.join('');
}

/**
 * The modules of a QR code for the text. The encoder loads on first use, so
 * it never weighs on the dashboard.
 */
export async function qrModules(text: string): Promise<boolean[][]> {
	const { encode } = await import('uqr');
	return encode(text, { ecc: 'M', border: 0 }).data;
}
