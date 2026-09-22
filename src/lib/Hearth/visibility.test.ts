import { describe, expect, it } from 'vitest';
import type { RailWidget } from './config';
import { evaluateVisibility, railWidgetShown, searchAvailable } from './visibility';

describe('evaluateVisibility', () => {
	const states = {
		'light.desk': { state: 'on' },
		'binary_sensor.window': { state: 'off' }
	} as any;

	it('ANDs entity and media conditions', () => {
		expect(
			evaluateVisibility(
				[{ entity: 'light.desk', state: 'on' }, { media: '(min-width: 800px)' }],
				states,
				{ '(min-width: 800px)': true }
			)
		).toBe(true);
		expect(
			evaluateVisibility(
				[{ entity: 'light.desk', state: 'on' }, { media: '(min-width: 800px)' }],
				states,
				{ '(min-width: 800px)': false }
			)
		).toBe(false);
	});

	it('does not treat a missing entity as satisfying state_not', () => {
		expect(evaluateVisibility([{ entity: 'light.missing', state_not: 'off' }], states, {})).toBe(
			false
		);
	});

	it('compares numeric windows and any-of groups', () => {
		const states = { 'sensor.t': { state: '21.5' }, 'switch.a': { state: 'off' } } as any;
		expect(evaluateVisibility([{ entity: 'sensor.t', above: 20 }], states, {})).toBe(true);
		expect(evaluateVisibility([{ entity: 'sensor.t', above: 20, below: 21 }], states, {})).toBe(
			false
		);
		expect(
			evaluateVisibility(
				[
					{
						or: [
							{ entity: 'switch.a', state: 'on' },
							{ entity: 'sensor.t', below: 30 }
						]
					}
				],
				states,
				{}
			)
		).toBe(true);
		expect(evaluateVisibility([{ or: [{ entity: 'switch.a', state: 'on' }] }], states, {})).toBe(
			false
		);
	});
});

describe('searchAvailable', () => {
	const states = { 'input_boolean.guests': { state: 'on' } } as never;
	const search = (extra: Partial<RailWidget> = {}) =>
		[{ id: 'search', type: 'search', ...extra }] as RailWidget[];

	it('needs a search widget', () => {
		expect(searchAvailable([], states, false)).toBe(false);
		expect(searchAvailable(search(), states, false)).toBe(true);
	});

	it('follows visibility conditions on every layout', () => {
		const hidden = search({ visibility: [{ entity: 'input_boolean.guests', state: 'off' }] });
		expect(searchAvailable(hidden, states, false)).toBe(false);
		expect(searchAvailable(hidden, states, true)).toBe(false);
		const byMedia = search({ visibility: [{ or: [{ media: '(min-width: 1px)' }] }] });
		expect(searchAvailable(byMedia, states, false, () => true)).toBe(true);
		expect(searchAvailable(byMedia, states, false, () => false)).toBe(false);
	});

	it('drops a widget hidden on mobile only while folded', () => {
		expect(searchAvailable(search({ mobile: 'hidden' }), states, true)).toBe(false);
		expect(searchAvailable(search({ mobile: 'hidden' }), states, false)).toBe(true);
		expect(searchAvailable(search({ hide_mobile: true }), states, true)).toBe(false);
	});

	it('lets an explicit mobile slot win over the legacy hide_mobile flag', () => {
		expect(searchAvailable(search({ hide_mobile: true, mobile: 'bottom' }), states, true)).toBe(
			true
		);
	});
});

describe('railWidgetShown', () => {
	it('reports whether any widget of a type is visible', () => {
		const rail = [
			{ id: 'nav', type: 'nav', visibility: [{ entity: 'sensor.missing' }] },
			{ id: 'clock', type: 'clock' }
		] as RailWidget[];
		expect(railWidgetShown(rail, 'nav', {}, { narrow: false })).toBe(false);
		expect(railWidgetShown(rail, 'clock', {}, { narrow: false })).toBe(true);
	});
});
