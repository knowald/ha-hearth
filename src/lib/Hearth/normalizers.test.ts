import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';
import {
	normalizeAction,
	normalizeEmbedUrl,
	normalizeEntityRef,
	normalizeSceneRef,
	normalizeVacuumModeRef,
	normalizeWholeNumber
} from './normalizers';

describe('normalizeAction', () => {
	it('keeps each kind with what it needs', () => {
		expect(normalizeAction({ action: 'toggle' })).toMatchObject({ action: 'toggle' });
		expect(normalizeAction({ action: 'more-info', entity: ' sensor.power ' })).toMatchObject({
			action: 'more-info',
			entity: 'sensor.power'
		});
		expect(normalizeAction({ action: 'navigate', navigation_path: ' kitchen ' })).toMatchObject({
			action: 'navigate',
			navigation_path: 'kitchen'
		});
		expect(normalizeAction({ action: 'url', url_path: 'https://example.com' })).toMatchObject({
			action: 'url',
			url_path: 'https://example.com'
		});
		expect(normalizeAction({ action: 'none' })).toMatchObject({ action: 'none' });
		expect(
			normalizeAction({
				action: 'perform-action',
				perform_action: 'light.turn_on',
				target: { entity_id: ['light.a', 'light.b'], area_id: 'kitchen' },
				data: { brightness_pct: 40 }
			})
		).toEqual({
			action: 'perform-action',
			perform_action: 'light.turn_on',
			target: { entity_id: ['light.a', 'light.b'], area_id: 'kitchen' },
			data: { brightness_pct: 40 }
		});
	});

	it('reads a Lovelace action pasted from YAML, legacy keys included', () => {
		const pasted = load(`
action: call-service
service: script.turn_on
service_data:
  entity_id: script.goodnight
  variables:
    dim: true
confirmation:
  text: Good night?
  exemptions:
    - user: abc
haptic: success
`);
		expect(normalizeAction(pasted)).toEqual({
			action: 'perform-action',
			perform_action: 'script.turn_on',
			data: { entity_id: 'script.goodnight', variables: { dim: true } },
			confirmation: { text: 'Good night?' }
		});
	});

	it('lets data win over service_data and reads confirmation flags', () => {
		const action = normalizeAction({
			action: 'perform-action',
			perform_action: 'fan.set_percentage',
			service_data: { percentage: 10, entity_id: 'fan.a' },
			data: { percentage: 50 },
			confirmation: true
		});
		expect(action).toMatchObject({
			data: { percentage: 50, entity_id: 'fan.a' },
			confirmation: true
		});
		expect(normalizeAction({ action: 'toggle', confirmation: false })?.confirmation).toBe(
			undefined
		);
		expect(normalizeAction({ action: 'toggle', confirmation: {} })?.confirmation).toBe(true);
	});

	it('drops actions that are unknown or miss what they need', () => {
		for (const raw of [
			undefined,
			'toggle',
			{ action: 'fire-dom-event' },
			{ action: 'perform-action' },
			{ action: 'perform-action', perform_action: 'not a service' },
			{ action: 'navigate' },
			{ action: 'url', url_path: 'javascript:alert(1)' },
			{ action: 'url', url_path: '//evil.example' },
			{ action: 'perform-action', perform_action: 'a.b', data: ['x'] }
		]) {
			expect(normalizeAction(raw)).toBeUndefined();
		}
	});

	it('normalizes tile actions on entity refs and keeps them off scenes', () => {
		const ref = normalizeEntityRef({
			entity: 'switch.fan',
			tap_action: { action: 'call-service', service: 'script.turn_on' },
			hold_action: { action: 'bogus' }
		});
		expect(ref?.tap_action).toEqual({
			action: 'perform-action',
			perform_action: 'script.turn_on'
		});
		expect(ref?.hold_action).toBeUndefined();
		const scene = normalizeSceneRef({ entity: 'scene.a', tap_action: { action: 'toggle' } });
		expect(scene).not.toHaveProperty('tap_action');
	});

	it('keeps tile templates verbatim on entity refs and drops blank ones and scene copies', () => {
		const ref = normalizeEntityRef({
			entity: 'switch.fan',
			name_template: "Fan {{ states('switch.fan') }} ",
			state_template: '   '
		});
		expect(ref?.name_template).toBe("Fan {{ states('switch.fan') }} ");
		expect(ref?.state_template).toBeUndefined();
		expect(normalizeEntityRef({ entity: 'switch.fan', name_template: 5 })?.name_template).toBe(
			undefined
		);
		const scene = normalizeSceneRef({ entity: 'scene.a', name_template: '{{ 1 }}' });
		expect(scene).not.toHaveProperty('name_template');
	});
});

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
			'/\\evil.com',
			'/\t/evil.com',
			'/lo\ncal/page.html',
			'https://example.com/a b',
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

	it('keeps the highlight fields off vacuum modes', () => {
		const mode = normalizeVacuumModeRef({
			entity: 'script.vacuum_kitchen',
			active_entity: 'sensor.a',
			active_states: ['on']
		});
		expect(mode?.entity).toBe('script.vacuum_kitchen');
		expect(mode).not.toHaveProperty('active_entity');
		expect(mode).not.toHaveProperty('active_states');
	});
});
