import { act, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import type { StatisticRow } from '$lib/core/ha/history';
import { DEFAULT_HEARTH_CONFIG, type RailWidget } from '../../config';
import { closePopup, hearthConfig, hearthEditMode, popup } from '../../store';
import type { ChartCard } from './descriptor';
import Card from './Card.svelte';

const mocks = vi.hoisted(() => ({
	fetchStatistics: vi.fn(),
	connected: undefined as unknown as import('svelte/store').Writable<boolean>,
	refresh: () => Promise.resolve()
}));

vi.mock('$lib/core/ha/connection', async (original) => {
	const { writable: store } = await import('svelte/store');
	mocks.connected = store(true);
	return {
		...(await original<typeof import('$lib/core/ha/connection')>()),
		connected: mocks.connected
	};
});

vi.mock('$lib/core/ha/history', async (original) => ({
	...(await original<typeof import('$lib/core/ha/history')>()),
	startDataRefresh: (load: () => Promise<unknown>, apply: (value: unknown) => void) => {
		mocks.refresh = () => load().then(apply);
		void mocks.refresh();
		return () => {};
	},
	cachedData: (_key: string, load: () => Promise<unknown>) => load(),
	fetchStatistics: mocks.fetchStatistics
}));

const HOUR = 3600 * 1000;
// built from its code, as the formatter would write the escape out as the sign itself
const DEGREES = `${String.fromCharCode(0xb0)}C`;
// the last full hour, so the newest bucket has ended and is not the running one
const LAST = Math.floor(Date.now() / HOUR) * HOUR - HOUR;

function hourly(
	values: (number | null)[],
	field: 'mean' | 'change' = 'mean',
	last = LAST
): StatisticRow[] {
	const first = last - (values.length - 1) * HOUR;
	return values.flatMap((value, index) =>
		value === null
			? []
			: [{ start: first + index * HOUR, end: first + (index + 1) * HOUR, [field]: value }]
	);
}

function chart(fields: Partial<ChartCard> = {}): ChartCard {
	return {
		id: 'chart',
		type: 'chart',
		entities: [{ entity: 'sensor.living', name: 'Living room' }, { entity: 'sensor.bedroom' }],
		...fields
	};
}

function setSensors(living = '21.4', bedroom = '19.7') {
	states.set({
		'sensor.living': hassEntity('sensor.living', living, {
			friendly_name: 'Living room sensor',
			unit_of_measurement: DEGREES
		}),
		'sensor.bedroom': hassEntity('sensor.bedroom', bedroom, {
			friendly_name: 'Bedroom',
			unit_of_measurement: DEGREES
		}),
		'sensor.energy': hassEntity('sensor.energy', '1284.6', {
			friendly_name: 'Energy',
			unit_of_measurement: 'kWh'
		})
	});
}

function useClock(timezone: string, hourFormat: '12' | '24' = '24') {
	const clock = { id: 'clock', type: 'clock', timezone, hour_format: hourFormat } as RailWidget;
	hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), rail: [clock] });
}

async function drawn(container: HTMLElement) {
	await waitFor(() => expect(container.querySelector('.chart-body.ready')).toBeTruthy());
}

// jsdom has no PointerEvent, so the pointer type is set by hand
async function pointer(target: Element, type: string, clientX = 0) {
	const event = new MouseEvent(type, { bubbles: true, clientX });
	Object.defineProperty(event, 'pointerType', { value: 'mouse' });
	await fireEvent(target, event);
}

const chipValue = (container: HTMLElement, entity: string) =>
	container.querySelector(`.legend-chip[data-entity="${entity}"] .legend-chip-value`)?.textContent;

describe('chart card', () => {
	beforeEach(() => {
		closePopup();
		useClock('UTC');
		mocks.connected.set(true);
		mocks.fetchStatistics.mockReset();
		mocks.fetchStatistics.mockResolvedValue({
			'sensor.living': hourly([20, 21, null, 23, 22]),
			'sensor.bedroom': hourly([18, 19, 19.5, 20, 19])
		});
		setSensors();
	});
	afterEach(() => {
		hearthEditMode.set(false);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('asks for every entity in one request', async () => {
		const { container } = render(Card, { card: chart({ period: 'week' }) });
		await drawn(container);
		expect(mocks.fetchStatistics).toHaveBeenCalledTimes(1);
		const [ids, start, end, period, options] = mocks.fetchStatistics.mock.calls[0];
		expect(ids).toEqual(['sensor.living', 'sensor.bedroom']);
		expect(end.getTime() - start.getTime()).toBe(7 * 24 * HOUR);
		expect(period).toBe('hour');
		expect(options).toEqual({ types: ['mean', 'state'] });
	});

	it('starts week and month bars at a midnight in the display zone', async () => {
		useClock('Asia/Kolkata');
		render(Card, {
			card: chart({ style: 'bar', period: 'week', entities: [{ entity: 'sensor.energy' }] })
		});
		await waitFor(() => expect(mocks.fetchStatistics).toHaveBeenCalled());
		const [, start, end, period] = mocks.fetchStatistics.mock.calls[0];
		expect(period).toBe('day');
		const wall = new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Asia/Kolkata',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		}).format(start);
		expect(wall).toBe('00:00');
		const span = end.getTime() - start.getTime();
		expect(span).toBeLessThanOrEqual(7 * 24 * HOUR);
		expect(span).toBeGreaterThan(6 * 24 * HOUR);
	});

	it('shows a chip per entity with its color, name and live reading, which opens its detail', async () => {
		render(Card, { card: chart() });
		const living = screen.getByRole('button', { name: /Living room/ });
		expect(living.textContent).toContain(`21.4${DEGREES}`);
		expect(living.querySelector<HTMLElement>('.dot')?.style.background).toBe(
			'var(--h-accent-icon)'
		);
		const bedroom = screen.getByRole('button', { name: /Bedroom/ });
		expect(bedroom.querySelector<HTMLElement>('.dot')?.style.background).toBe('var(--h-cool-icon)');
		await fireEvent.click(living);
		expect(get(popup)).toMatchObject({
			kind: 'detail',
			entity: 'sensor.living',
			name: 'Living room'
		});
	});

	it('shows the newest bar in a bar chip, not the meter total, and - until it loads', async () => {
		let resolve: (value: unknown) => void = () => {};
		mocks.fetchStatistics.mockReturnValue(new Promise((done) => (resolve = done)));
		const { container } = render(Card, {
			card: chart({ style: 'bar', entities: [{ entity: 'sensor.energy' }] })
		});
		await waitFor(() => expect(mocks.fetchStatistics).toHaveBeenCalled());
		expect(chipValue(container, 'sensor.energy')).toBe('-');
		resolve({ 'sensor.energy': hourly([1.2, 0.8, null], 'change') });
		await drawn(container);
		expect(chipValue(container, 'sensor.energy')).toBe('0.8 kWh');
	});

	it('draws a line per entity, broken where a bucket is missing', async () => {
		const { container } = render(Card, { card: chart() });
		await drawn(container);
		const lines = [...container.querySelectorAll('path.line')].map((path) =>
			path.getAttribute('d')
		);
		expect(lines).toHaveLength(2);
		expect(lines[0]?.match(/M/g)).toHaveLength(2);
		expect(lines[1]?.match(/M/g)).toHaveLength(1);
		expect(lines.join('')).not.toContain('NaN');
		const ticks = [...container.querySelectorAll('.y-axis span')].map((tick) =>
			tick.textContent?.trim()
		);
		expect(ticks).toEqual(['18', '20', '22', '24']);
	});

	it('labels the day every six hours of the display zone, in its hour format', async () => {
		useClock('Asia/Kolkata', '24');
		const { container } = render(Card, { card: chart() });
		await drawn(container);
		const labels = [...container.querySelectorAll('.x-axis .tick')].map((tick) =>
			tick.textContent?.trim()
		);
		expect(labels).toHaveLength(4);
		for (const label of labels) expect(label).toMatch(/^(00|06|12|18):00$/);
		const positions = [...container.querySelectorAll<HTMLElement>('.x-axis .tick')].map((tick) =>
			parseFloat(tick.style.left)
		);
		expect(positions).toEqual([...positions].sort((a, b) => a - b));
		expect(new Set(positions.map((left) => Math.round(left))).size).toBe(4);
	});

	it('names a selected time in the rail clock zone and hour format', async () => {
		useClock('America/New_York', '12');
		const { container } = render(Card, { card: chart() });
		await drawn(container);
		await fireEvent.click(screen.getByRole('slider'), { clientX: 0 });
		const expected = new Intl.DateTimeFormat(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			hour12: true,
			timeZone: 'America/New_York'
		}).format(LAST - 4 * HOUR);
		expect(container.querySelector('.readout')?.textContent?.trim()).toBe(expected);
	});

	it('draws the last hour from five-minute statistics and names a time by its minutes', async () => {
		useClock('Asia/Kathmandu', '24');
		const five = 5 * 60 * 1000;
		const last = Math.floor(Date.now() / five) * five - five;
		const rows = [21, 21.5, 22].map((mean, index) => ({
			start: last - (2 - index) * five,
			end: last - (1 - index) * five,
			mean
		}));
		mocks.fetchStatistics.mockResolvedValue({ 'sensor.living': rows });
		const { container } = render(Card, {
			card: chart({ period: 'hour', entities: [{ entity: 'sensor.living' }] })
		});
		await drawn(container);
		expect(mocks.fetchStatistics).toHaveBeenCalledTimes(1);
		const [ids, start, end, period, options] = mocks.fetchStatistics.mock.calls[0];
		expect(ids).toEqual(['sensor.living']);
		expect(period).toBe('5minute');
		expect(options).toEqual({ types: ['mean', 'state'] });
		expect(start.getTime() % five).toBe(0);
		expect(end.getTime() - start.getTime()).toBeLessThanOrEqual(HOUR);
		expect(end.getTime() - start.getTime()).toBeGreaterThan(HOUR - five);
		expect(container.querySelector('.period')?.textContent).toBe('Last hour');
		expect(container.querySelectorAll('path.line')).toHaveLength(1);
		for (const tick of container.querySelectorAll('.x-axis .tick')) {
			expect(tick.textContent?.trim()).toMatch(/^\d\d:(00|15|30|45)$/);
		}
		await fireEvent.click(screen.getByRole('slider'), { clientX: 0 });
		const expected = new Intl.DateTimeFormat(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
			timeZone: 'Asia/Kathmandu'
		}).format(rows[0].start);
		expect(container.querySelector('.readout')?.textContent?.trim()).toBe(expected);
	});

	it('marks a point with no neighbour, which a line alone would not show', async () => {
		mocks.fetchStatistics.mockResolvedValue({
			'sensor.living': hourly([20, null, 22, null, 21])
		});
		const { container } = render(Card, {
			card: chart({ entities: [{ entity: 'sensor.living' }] })
		});
		await drawn(container);
		expect(container.querySelectorAll('circle.single')).toHaveLength(3);
	});

	it('draws bars from the change, a negative one below zero', async () => {
		mocks.fetchStatistics.mockResolvedValue({ 'sensor.living': hourly([2, -1, 3], 'change') });
		const { container } = render(Card, {
			card: chart({ style: 'bar', entities: [{ entity: 'sensor.living' }] })
		});
		await drawn(container);
		expect(mocks.fetchStatistics.mock.calls[0][4]).toEqual({ types: ['change', 'mean'] });
		const bars = [...container.querySelectorAll<SVGRectElement>('rect.bar')];
		expect(bars).toHaveLength(3);
		const zero = Number(container.querySelector('.grid.zero')?.getAttribute('y1'));
		const [up, down] = bars;
		expect(Number(up.getAttribute('y')) + Number(up.getAttribute('height'))).toBeCloseTo(zero);
		expect(Number(down.getAttribute('y'))).toBeCloseTo(zero);
		expect(container.querySelectorAll('rect.bar.current')).toHaveLength(0);
	});

	it('draws the running bucket dashed', async () => {
		const now = Date.now();
		mocks.fetchStatistics.mockResolvedValue({
			'sensor.living': [{ start: now - HOUR / 2, end: now + HOUR / 2, change: 1 }]
		});
		const { container } = render(Card, {
			card: chart({ style: 'bar', entities: [{ entity: 'sensor.living' }] })
		});
		await drawn(container);
		expect(container.querySelectorAll('rect.bar.current')).toHaveLength(1);
	});

	it('selects the nearest bucket on a tap, shows its values in the chips and steps with keys', async () => {
		const { container } = render(Card, { card: chart() });
		await drawn(container);
		const plot = screen.getByRole('slider', { name: 'Chart' });
		expect(plot.getAttribute('tabindex')).toBe('0');
		expect(container.querySelector('.readout.idle')).toBeTruthy();
		expect(chipValue(container, 'sensor.living')).toBe(`21.4${DEGREES}`);

		// jsdom lays out nothing, so the plot is 1px wide and clientX is the fraction
		await fireEvent.click(plot, { clientX: 0 });
		expect(plot.getAttribute('aria-valuenow')).toBe('0');
		expect(container.querySelector('.readout.idle')).toBeNull();
		expect(chipValue(container, 'sensor.living')).toBe(`20${DEGREES}`);
		expect(chipValue(container, 'sensor.bedroom')).toBe(`18${DEGREES}`);
		expect(container.querySelector('line.cursor')).toBeTruthy();
		expect(container.querySelectorAll('circle.marker')).toHaveLength(2);

		await fireEvent.keyDown(plot, { key: 'ArrowRight' });
		await fireEvent.keyDown(plot, { key: 'ArrowRight' });
		expect(plot.getAttribute('aria-valuenow')).toBe('2');
		// the living room has no value in the third bucket
		expect(plot.getAttribute('aria-valuetext')).toMatch(
			new RegExp(`, Living room -, Bedroom 19.5${DEGREES}$`)
		);
		expect(chipValue(container, 'sensor.living')).toBe('-');
		expect(container.querySelectorAll('circle.marker')).toHaveLength(1);

		await fireEvent.keyDown(plot, { key: 'End' });
		expect(plot.getAttribute('aria-valuenow')).toBe('4');
		await fireEvent.keyDown(plot, { key: 'Escape' });
		expect(container.querySelector('.readout.idle')).toBeTruthy();
		expect(chipValue(container, 'sensor.living')).toBe(`21.4${DEGREES}`);
	});

	it('announces a change on the first arrow press', async () => {
		const { container } = render(Card, { card: chart() });
		await drawn(container);
		const plot = screen.getByRole('slider');
		const idle = plot.getAttribute('aria-valuetext');
		expect(idle).toBe('Last 24 hours');
		await fireEvent.keyDown(plot, { key: 'ArrowLeft' });
		expect(plot.getAttribute('aria-valuenow')).toBe('4');
		expect(plot.getAttribute('aria-valuetext')).not.toBe(idle);
		expect(plot.getAttribute('aria-valuetext')).toContain('Living room 22');
		await fireEvent.keyDown(plot, { key: 'ArrowLeft' });
		expect(plot.getAttribute('aria-valuenow')).toBe('3');
	});

	it('keeps a clicked time when the mouse leaves, and drops one only hovered', async () => {
		const { container } = render(Card, { card: chart() });
		await drawn(container);
		const plot = screen.getByRole('slider');
		await pointer(plot, 'pointermove', 0);
		expect(container.querySelector('.readout.idle')).toBeNull();
		await pointer(plot, 'pointerleave');
		expect(container.querySelector('.readout.idle')).toBeTruthy();

		await fireEvent.click(plot, { clientX: 0 });
		await pointer(plot, 'pointermove', 1);
		expect(plot.getAttribute('aria-valuenow')).toBe('0');
		await pointer(plot, 'pointerleave');
		expect(plot.getAttribute('aria-valuenow')).toBe('0');
		expect(container.querySelector('.readout.idle')).toBeNull();
	});

	it('keeps the selected time, not its position, through a refresh', async () => {
		const { container } = render(Card, { card: chart() });
		await drawn(container);
		const plot = screen.getByRole('slider');
		await fireEvent.click(plot, { clientX: 0 });
		await fireEvent.keyDown(plot, { key: 'ArrowRight' });
		const time = container.querySelector('.readout')?.textContent;
		expect(plot.getAttribute('aria-valuenow')).toBe('1');

		// the window slid on: the oldest bucket is gone and a new one came in
		mocks.fetchStatistics.mockResolvedValue({
			'sensor.living': hourly([21, null, 23, 22, 24], 'mean', LAST + HOUR),
			'sensor.bedroom': hourly([19, 19.5, 20, 19, 18], 'mean', LAST + HOUR)
		});
		await act(() => mocks.refresh());
		await waitFor(() => expect(plot.getAttribute('aria-valuenow')).toBe('0'));
		expect(container.querySelector('.readout')?.textContent).toBe(time);
		expect(chipValue(container, 'sensor.living')).toBe(`21${DEGREES}`);
	});

	it('lets go of a pinned time once a refresh no longer has it', async () => {
		const { container } = render(Card, { card: chart() });
		await drawn(container);
		const plot = screen.getByRole('slider');
		await fireEvent.click(plot, { clientX: 0 });
		expect(container.querySelector('.readout.idle')).toBeNull();

		mocks.fetchStatistics.mockResolvedValue({
			'sensor.living': hourly([21, null, 23, 22, 24], 'mean', LAST + HOUR),
			'sensor.bedroom': hourly([19, 19.5, 20, 19, 18], 'mean', LAST + HOUR)
		});
		await act(() => mocks.refresh());
		await waitFor(() => expect(container.querySelector('.readout.idle')).toBeTruthy());
		// hover selects again, which a pin left behind would refuse
		await pointer(plot, 'pointermove');
		expect(container.querySelector('.readout.idle')).toBeNull();
	});

	it('names the plot after the card', async () => {
		const { container } = render(Card, { card: chart({ name: 'Temperature' }) });
		await drawn(container);
		expect(screen.getByRole('slider', { name: 'Temperature' })).toBeTruthy();
		expect(container.querySelector('.name')?.textContent).toBe('Temperature');
		expect(container.querySelector('.period')?.textContent).toBe('Last 24 hours');
	});

	it('shows the empty state when the recorder has nothing', async () => {
		mocks.fetchStatistics.mockResolvedValue({});
		render(Card, { card: chart() });
		expect(await screen.findByText('No recorded history')).toBeTruthy();
	});

	it('says it is not connected before any data arrived', async () => {
		mocks.connected.set(false);
		render(Card, { card: chart() });
		expect(await screen.findByText('Not connected to Home Assistant')).toBeTruthy();
		expect(mocks.fetchStatistics).not.toHaveBeenCalled();
	});

	it('shows a missing entity as text and an unavailable one with its state', () => {
		states.set({
			'sensor.bedroom': hassEntity('sensor.bedroom', 'unavailable', { friendly_name: 'Bedroom' })
		});
		const { container } = render(Card, { card: chart() });
		const chips = [...container.querySelectorAll('.legend-chip')];
		expect(chips[0].tagName).toBe('SPAN');
		expect(chips[0].textContent).toContain('Missing entity');
		expect(chips[1].tagName).toBe('BUTTON');
		expect(chips[1].textContent).toContain('Unavailable');
	});

	it('shows - for a reading that is not a number', () => {
		setSensors('on');
		render(Card, { card: chart() });
		expect(screen.getByRole('button', { name: /Living room/ }).textContent).toContain('-');
	});

	it('takes a set color through styleColor and fades a fifth series without one', () => {
		const entities: ChartCard['entities'] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({
			entity: `sensor.${id}`
		}));
		entities[1] = { entity: 'sensor.b', color: 'red; background: url(x)' };
		entities[2] = { entity: 'sensor.c', color: 'Bad' };
		const { container } = render(Card, { card: chart({ entities }) });
		const dots = [...container.querySelectorAll<HTMLElement>('.legend .dot')];
		expect(dots.map((dot) => dot.style.background)).toEqual([
			'var(--h-accent-icon)',
			'var(--h-cool-icon)',
			'var(--h-bad-text)',
			'var(--h-bad-text)',
			'var(--h-accent-icon)'
		]);
		expect(dots.map((dot) => dot.classList.contains('faded'))).toEqual([
			false,
			false,
			false,
			false,
			true
		]);
		expect(container.innerHTML).not.toContain('url(x)');
	});

	it('does nothing on a tap in edit mode', async () => {
		hearthEditMode.set(true);
		const { container } = render(Card, { card: chart() });
		await drawn(container);
		expect(screen.queryAllByRole('button')).toHaveLength(0);
		const plot = screen.getByRole('slider');
		expect(plot.getAttribute('aria-disabled')).toBe('true');
		expect(plot.getAttribute('tabindex')).toBe('-1');
		await fireEvent.click(plot, { clientX: 0 });
		expect(container.querySelector('.readout.idle')).toBeTruthy();
	});
});
