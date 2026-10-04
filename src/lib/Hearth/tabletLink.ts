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
 * its frontend, so the app's own port has to be entered instead. The page's
 * directory, since the app may be served below a path of its own.
 */
export function directAddress(location: Pick<Location, 'href' | 'pathname'>) {
	if (isIngressPath(location.pathname)) return undefined;
	return new URL('.', location.href).href;
}

/**
 * The dashboard address with the device name the tablet should answer to, or
 * undefined for anything that is not an http(s) address. An address typed
 * without a scheme, such as homeassistant.local:5050, is taken as http.
 */
export function tabletUrl(address: string, device = ''): string | undefined {
	const trimmed = address.trim();
	if (!trimmed) return undefined;
	let url: URL;
	try {
		url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`);
	} catch {
		return undefined;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
	const name = device.trim();
	if (name) url.searchParams.set('device', name);
	else url.searchParams.delete('device');
	return url.href;
}

/** An address that names this device itself, which a tablet would resolve to itself. */
export function isLocalAddress(url: string): boolean {
	const host = new URL(url).hostname;
	return host === 'localhost' || host === '[::1]' || host.startsWith('127.');
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
