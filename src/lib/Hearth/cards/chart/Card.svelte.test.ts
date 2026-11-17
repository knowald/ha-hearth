import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import type { StatisticRow } from '$lib/core/ha/history';
import { closePopup, hearthEditMode, popup } from '../../store';
import type { ChartCard } from './descriptor';
import Card from './Card.svelte';

const mocks = vi.hoisted(() => ({
	fetchStatistics: vi.fn(),
	connected: undefined as unknown as import('svelte/store').Writable<boolean>
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
		void load().then(apply);
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

function hourly(values: (number | null)[], field: 'mean' | 'change' = 'mean'): StatisticRow[] {
	const first = LAST - (values.length - 1) * HOUR;
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
		})
	});
}

async function drawn(container: HTMLElement) {
	await waitFor(() => expect(container.querySelector('.chart-body.ready')).toBeTruthy());
}

describe('chart card', () => {
	beforeEach(() => {
		closePopup();
		mocks.connected.set(true);
		mocks.fetchStatistics.mockReset();
		mocks.fetchStatistics.mockResolvedValue({
			'sensor.living': hourly([20, 21, null, 23, 22]),
			'sensor.bedroom': hourly([18, 19, 19.5, 20, 19])
		});
		setSensors();
	});
	afterEach(() => hearthEditMode.set(false));

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

	it('shows a chip per entity with its color, name and reading, which opens its detail', async () => {
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
		expect(container.querySelectorAll('.x-axis span')).toHaveLength(3);
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

	it('selects the nearest bucket on a tap and steps with the arrow keys', async () => {
		const { container } = render(Card, { card: chart() });
		await drawn(container);
		const plot = screen.getByRole('slider', { name: 'Chart' });
		expect(plot.getAttribute('tabindex')).toBe('0');
		expect(container.querySelector('.readout.idle')).toBeTruthy();

		// jsdom lays out nothing, so the plot is 1px wide and clientX is the fraction
		await fireEvent.click(plot, { clientX: 0 });
		expect(plot.getAttribute('aria-valuenow')).toBe('0');
		expect(container.querySelector('.readout.idle')).toBeNull();
		const readout = container.querySelector('.readout')?.textContent ?? '';
		expect(readout).toContain('Living room');
		expect(readout).toContain(`20${DEGREES}`);
		expect(readout).toContain(`18${DEGREES}`);
		expect(container.querySelector('line.cursor')).toBeTruthy();
		expect(container.querySelectorAll('circle.marker')).toHaveLength(2);

		await fireEvent.keyDown(plot, { key: 'ArrowRight' });
		await fireEvent.keyDown(plot, { key: 'ArrowRight' });
		expect(plot.getAttribute('aria-valuenow')).toBe('2');
		// the living room has no value in the third bucket
		expect(plot.getAttribute('aria-valuetext')).toMatch(
			new RegExp(`, Living room -, Bedroom 19.5${DEGREES}$`)
		);
		expect(container.querySelectorAll('circle.marker')).toHaveLength(1);

		await fireEvent.keyDown(plot, { key: 'End' });
		expect(plot.getAttribute('aria-valuenow')).toBe('4');
		await fireEvent.keyDown(plot, { key: 'Escape' });
		expect(container.querySelector('.readout.idle')).toBeTruthy();
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
		const chips = [...container.querySelectorAll('.chip')];
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
		const entities = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ entity: `sensor.${id}` }));
		entities[1] = { entity: 'sensor.b', color: 'red; background: url(x)' } as never;
		entities[2] = { entity: 'sensor.c', color: 'Bad' } as never;
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
