import { writable } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import type { StyleRule, VisibilityCondition } from './config';
import {
	clockFor,
	evaluateVisibility,
	inTimeWindow,
	matchStyleRule,
	styleColor,
	usesTime
} from './visibility';

describe('device, time and attribute conditions', () => {
	// 2026-10-02 is a Friday
	const at = (time: string, day = 2) => new Date(`2026-10-0${day}T${time}:00`);

	it('matches the device name against one name or a list', () => {
		expect(evaluateVisibility([{ device: 'kitchen' }], {}, {}, { device: 'kitchen' })).toBe(true);
		expect(
			evaluateVisibility([{ device: ['hall', 'kitchen'] }], {}, {}, { device: ' kitchen ' })
		).toBe(true);
		expect(evaluateVisibility([{ device: ['hall'] }], {}, {}, { device: 'kitchen' })).toBe(false);
		// a screen without a name is no device
		expect(evaluateVisibility([{ device: 'kitchen' }], {}, {}, {})).toBe(false);
	});

	it('holds from after up to before on the same day', () => {
		const window = { after: '08:00', before: '17:30' };
		expect(inTimeWindow(window, at('08:00'))).toBe(true);
		expect(inTimeWindow(window, at('17:29'))).toBe(true);
		expect(inTimeWindow(window, at('17:30'))).toBe(false);
		expect(inTimeWindow(window, at('07:59'))).toBe(false);
		expect(inTimeWindow({ after: '20:00' }, at('23:59'))).toBe(true);
		expect(inTimeWindow({ before: '06:00' }, at('06:00'))).toBe(false);
	});

	it('runs a window past midnight', () => {
		const night = { after: '22:00', before: '06:00' };
		expect(inTimeWindow(night, at('23:00'))).toBe(true);
		expect(inTimeWindow(night, at('02:00'))).toBe(true);
		expect(inTimeWindow(night, at('06:00'))).toBe(false);
		expect(inTimeWindow(night, at('12:00'))).toBe(false);
	});

	it('counts the early hours of a night window as the day it started', () => {
		const friday = { after: '22:00', before: '06:00', weekdays: ['fri' as const] };
		expect(inTimeWindow(friday, at('23:00', 2))).toBe(true);
		// 02:00 on Saturday is still Friday night
		expect(inTimeWindow(friday, at('02:00', 3))).toBe(true);
		// 02:00 on Friday belongs to Thursday night
		expect(inTimeWindow(friday, at('02:00', 2))).toBe(false);
	});

	it('limits a window to weekdays, or a whole day without times', () => {
		expect(inTimeWindow({ weekdays: ['sat', 'sun'] }, at('12:00', 4))).toBe(true);
		expect(inTimeWindow({ weekdays: ['sat', 'sun'] }, at('12:00', 2))).toBe(false);
		expect(evaluateVisibility([{ time: { after: '09:00' } }], {}, {}, { now: at('10:00') })).toBe(
			true
		);
		expect(evaluateVisibility([{ time: { after: '09:00' } }], {}, {}, { now: at('08:00') })).toBe(
			false
		);
	});

	it('reads one attribute with state or numeric bounds', () => {
		const states = {
			'climate.living': {
				state: 'heat',
				attributes: { hvac_action: 'heating', current_temperature: 19.5 }
			}
		} as never;
		const action = (rest: object): VisibilityCondition[] => [
			{ entity: 'climate.living', attribute: 'hvac_action', ...rest }
		];
		expect(evaluateVisibility(action({ state: 'heating' }), states, {})).toBe(true);
		expect(evaluateVisibility(action({ state: 'idle' }), states, {})).toBe(false);
		expect(evaluateVisibility(action({ state_not: 'idle' }), states, {})).toBe(true);
		const temperature = [
			{ entity: 'climate.living', attribute: 'current_temperature', above: 19, below: 20 }
		];
		expect(evaluateVisibility(temperature, states, {})).toBe(true);
		// a missing attribute is unknown, like a missing entity
		expect(
			evaluateVisibility(
				[{ entity: 'climate.living', attribute: 'nope', state_not: 'x' }],
				states,
				{}
			)
		).toBe(false);
	});

	it('finds time conditions inside or-groups', () => {
		expect(usesTime([{ or: [{ entity: 'a.b' }, { time: { after: '10:00' } }] }])).toBe(true);
		expect(usesTime([{ entity: 'a.b' }, { device: 'x' }])).toBe(false);
		expect(usesTime(undefined)).toBe(false);
	});

	it('runs the minute clock only for conditions that read the time', () => {
		const conditions = writable<VisibilityCondition[]>([{ entity: 'a.b' }]);
		const values: (Date | undefined)[] = [];
		const stop = clockFor(conditions).subscribe((value) => values.push(value));
		expect(values.at(-1)).toBeUndefined();
		conditions.set([{ time: { after: '10:00' } }]);
		expect(values.at(-1)).toBeInstanceOf(Date);
		stop();
	});
});

describe('style rules', () => {
	const states = {
		'lock.front': { state: 'unlocked' },
		'binary_sensor.door': { state: 'on' }
	} as never;

	it('picks the first rule whose conditions hold', () => {
		const rules: StyleRule[] = [
			{ conditions: [{ entity: 'lock.front', state: 'locked' }], color: 'good' },
			{
				conditions: [{ entity: 'lock.front', state: 'unlocked' }],
				color: 'bad',
				icon: 'lock_open'
			},
			{ conditions: [{ entity: 'binary_sensor.door', state: 'on' }], color: 'accent' }
		];
		expect(matchStyleRule(rules, states, {})).toBe(rules[1]);
		expect(matchStyleRule(rules.slice(2), states, {})).toBe(rules[2]);
		expect(matchStyleRule([rules[0]], states, {})).toBeUndefined();
		expect(matchStyleRule(undefined, states, {})).toBeUndefined();
	});

	it('reads the device and the time for its conditions', () => {
		const rules: StyleRule[] = [
			{ conditions: [{ device: 'kitchen' }], class: 'kitchen-only' },
			{ conditions: [{ time: { after: '22:00', before: '06:00' } }], class: 'night' }
		];
		const night = new Date('2026-10-02T23:00:00');
		expect(matchStyleRule(rules, states, { device: 'kitchen', now: night })).toBe(rules[0]);
		expect(matchStyleRule(rules, states, { device: 'hall', now: night })).toBe(rules[1]);
	});

	it('maps theme names to tokens and passes plain colors through', () => {
		expect(styleColor('bad')).toBe('var(--h-bad-text)');
		expect(styleColor(' Accent ')).toBe('var(--h-accent-icon)');
		expect(styleColor('#E53935')).toBe('#e53935');
		expect(styleColor('rgb(200, 40, 40)')).toBe('rgb(200, 40, 40)');
		expect(styleColor('tomato')).toBe('tomato');
		expect(styleColor('red; background: url(x)')).toBeUndefined();
		expect(styleColor(undefined)).toBeUndefined();
	});
});
