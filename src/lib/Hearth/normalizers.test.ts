import { describe, expect, it } from 'vitest';
import {
	normalizeEmbedUrl,
	normalizeEntityRef,
	normalizeSceneRef,
	normalizeWholeNumber
} from './normalizers';

describe('normalizeEmbedUrl', () => {
	it('keeps http(s) addresses and same-host paths', () => {
		expect(normalizeEmbedUrl(' https://example.com/a?b=1 ')).toBe('https://example.com/a?b=1');
		expect(normalizeEmbedUrl('http://192.168.1.2:8123/x')).toBe('http://192.168.1.2:8123/x');
		expect(normalizeEmbedUrl('/local/page.html')).toBe('/local/page.html');
		expect(normalizeEmbedUrl('about:blank')).toBe('about:blank');
	});

	it('drops other schemes and protocol-relative addresses', () => {
		for (const url of [
			'javascript:alert(1)',
			'data:text/html,hi',
			'file:///etc/passwd',
			'//evil',
			'',
			3
		]) {
			expect(normalizeEmbedUrl(url)).toBeUndefined();
		}
	});
});

describe('normalizeWholeNumber', () => {
	it('rounds finite numbers at or above the minimum and drops the rest', () => {
		expect(normalizeWholeNumber(12.4, 0)).toBe(12);
		expect(normalizeWholeNumber(0, 0)).toBe(0);
		expect(normalizeWholeNumber(0, 1)).toBeUndefined();
		for (const raw of [-1, NaN, Infinity, -Infinity, '12', null, [], {}]) {
			expect(normalizeWholeNumber(raw, 0)).toBeUndefined();
		}
	});
});

describe('normalizeEntityRef tile highlight', () => {
	it('trims the highlight entity and stringifies, trims and filters the states', () => {
		const ref = normalizeEntityRef({
			entity: 'sensor.washer',
			active_entity: '  sensor.washer_status ',
			active_states: [' running ', true, 22, '', '   ', null, {}]
		});
		expect(ref?.active_entity).toBe('sensor.washer_status');
		expect(ref?.active_states).toEqual(['running', 'true', '22']);
	});

	it('drops blank entities and empty or non-list states', () => {
		for (const active_states of [[], ['', ' '], 'running', 3, null]) {
			const ref = normalizeEntityRef({ entity: 'sensor.a', active_entity: '  ', active_states });
			expect(ref?.active_entity).toBeUndefined();
			expect(ref?.active_states).toBeUndefined();
		}
	});

	it('keeps the highlight list off scene refs', () => {
		const scene = normalizeSceneRef({
			entity: 'scene.a',
			active_entity: 'input_boolean.a',
			active_states: ['on']
		});
		expect(scene?.active_entity).toBe('input_boolean.a');
		expect(scene).not.toHaveProperty('active_states');
	});
});
