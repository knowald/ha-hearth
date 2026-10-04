import { describe, expect, it } from 'vitest';
import { directAddress, isIngressPath, qrModules, qrPath, tabletUrl } from './tabletLink';

describe('directAddress', () => {
	it('is the address the dashboard runs at, base path included', () => {
		expect(directAddress({ origin: 'http://192.168.1.5:5050', pathname: '/' }, '')).toBe(
			'http://192.168.1.5:5050/'
		);
		expect(directAddress({ origin: 'https://ha.example', pathname: '/hearth/' }, '/hearth')).toBe(
			'https://ha.example/hearth/'
		);
	});

	it('is unknown under Ingress, whose address only works inside Home Assistant', () => {
		const location = {
			origin: 'https://example.ui.nabu.casa',
			pathname: '/api/hassio_ingress/abc123/'
		};
		expect(isIngressPath(location.pathname)).toBe(true);
		expect(directAddress(location, '')).toBeUndefined();
	});
});

describe('tabletUrl', () => {
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
		expect(tabletUrl('homeassistant.local:5050')).toBeUndefined();
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
