import { describe, expect, it } from 'vitest';
import {
	directAddress,
	isIngressPath,
	isLocalAddress,
	qrModules,
	qrPath,
	tabletUrl
} from './tabletLink';

function at(href: string) {
	return { href, pathname: new URL(href).pathname };
}

describe('directAddress', () => {
	it('is the directory the dashboard runs in, without its parameters', () => {
		expect(directAddress(at('http://192.168.1.5:5050/?room=office'))).toBe(
			'http://192.168.1.5:5050/'
		);
		expect(directAddress(at('https://ha.example/hearth/?menu=false#x'))).toBe(
			'https://ha.example/hearth/'
		);
	});

	it('is unknown under Ingress, whose address only works inside Home Assistant', () => {
		const location = at('https://example.ui.nabu.casa/api/hassio_ingress/abc123/');
		expect(isIngressPath(location.pathname)).toBe(true);
		expect(directAddress(location)).toBeUndefined();
	});
});

describe('isLocalAddress', () => {
	it('spots addresses a tablet would resolve to itself', () => {
		expect(isLocalAddress('http://localhost:5050/')).toBe(true);
		expect(isLocalAddress('http://127.0.0.1:5050/')).toBe(true);
		expect(isLocalAddress('http://[::1]:5050/')).toBe(true);
		expect(isLocalAddress('http://192.168.1.5:5050/')).toBe(false);
	});
});

describe('tabletUrl', () => {
	it('takes an address without a scheme as http', () => {
		expect(tabletUrl('homeassistant.local:5050')).toBe('http://homeassistant.local:5050/');
	});

	it('adds the device name, encoded', () => {
		expect(tabletUrl('http://hearth.local:5050/', ' Kitchen wall ')).toBe(
			'http://hearth.local:5050/?device=Kitchen+wall'
		);
	});

	it('keeps other parameters and leaves the name out when there is none', () => {
		expect(tabletUrl('http://hearth.local/?menu=false&device=old')).toBe(
			'http://hearth.local/?menu=false'
		);
	});

	it('refuses what a tablet browser could not open', () => {
		expect(tabletUrl('')).toBeUndefined();
		expect(tabletUrl('   ')).toBeUndefined();
		expect(tabletUrl('ftp://hearth.local/')).toBeUndefined();
		expect(tabletUrl('javascript:alert(1)')).toBeUndefined();
	});
});

describe('QR code', () => {
	it('draws one unit square per dark module', () => {
		expect(
			qrPath([
				[true, false],
				[false, true]
			])
		).toBe('M0 0h1v1h-1zM1 1h1v1h-1z');
	});

	it('encodes the address into a square with the three finder patterns', async () => {
		const modules = await qrModules('http://hearth.local:5050/?device=kitchen');
		const size = modules.length;
		expect(size).toBeGreaterThanOrEqual(21);
		expect(modules.every((row) => row.length === size)).toBe(true);
		// each finder pattern has a dark 7-module edge along its top row
		for (const [row, column] of [
			[0, 0],
			[0, size - 7],
			[size - 7, 0]
		]) {
			expect(modules[row].slice(column, column + 7).every(Boolean)).toBe(true);
		}
	});
});
