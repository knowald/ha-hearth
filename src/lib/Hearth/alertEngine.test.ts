import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HassEntities } from 'home-assistant-js-websocket';
import { hassEntity } from '$lib/core/ha/testing';
import { states } from '$lib/core/ha/entities';
import { health } from '$lib/core/ha/connection';
import { DEFAULT_HEARTH_CONFIG } from './config';
import {
	dismissAlert,
	handleHearthAction,
	parseHearthEvent,
	resetAlerts,
	setAlertHost,
	startAlerts,
	syncRules
} from './alertEngine';
import { openEntityDetail } from './details';
import { ALERT_SEVERITIES } from './model/alerts';
import { loadMarkdownRenderer } from './markdown';
import { layer } from '$lib/ui/layers';
import { clockFor, conditionsHeldAtMost, conditionsHold } from './visibility';
import { showPage } from './pages';
import { playAlertChime } from './chimeGate';

vi.mock('./chimeGate', async (importOriginal) => ({
	...(await importOriginal<typeof import('./chimeGate')>()),
	playAlertChime: vi.fn(() => Promise.resolve(true))
}));

// what the dashboard reports as covering the screen (This screen, setup)
let sleepBlocked = false;
import {
	activeAlerts,
	cancelEdit,
	currentRoom,
	enterEditMode,
	hearthConfig,
	hearthEditMode,
	popup,
	screensaverPreview,
	wakeScreen
} from './store';
import { deviceName } from '$lib/core/app/device';
import type { AlertRule } from './types';

const START = new Date('2026-09-27T12:00:00Z');

const fridge: AlertRule = {
	id: 'fridge',
	title: 'Fridge door open',
	severity: 'warning',
	conditions: [{ entity: 'binary_sensor.fridge_door', state: 'on' }],
	for_seconds: 120
};

function door(state: string, changedSecondsAgo = 0): HassEntities {
	const entity = hassEntity('binary_sensor.fridge_door', state);
	entity.last_changed = new Date(Date.now() - changedSecondsAgo * 1000).toISOString();
	return { 'binary_sensor.fridge_door': entity };
}

const hot: AlertRule = {
	id: 'hot',
	title: 'Too hot',
	severity: 'warning',
	conditions: [{ entity: 'climate.living', attribute: 'current_temperature', above: 28 }],
	for_seconds: 120
};

// the state has read heat for an hour; the reading moved `updatedSecondsAgo`
function thermostat(temperature: number, updatedSecondsAgo = 0): HassEntities {
	const entity = hassEntity('climate.living', 'heat', { current_temperature: temperature });
	entity.last_changed = new Date(Date.now() - 3_600_000).toISOString();
	entity.last_updated = new Date(Date.now() - updatedSecondsAgo * 1000).toISOString();
	return { 'climate.living': entity };
}

const host = {
	openDetail: openEntityDetail,
	holds: conditionsHold,
	clockFor,
	heldAtMost: conditionsHeldAtMost,
	showPage,
	sleepBlocked: () => sleepBlocked,
	layer,
	loadMarkdown: loadMarkdownRenderer
};
setAlertHost(host);

const keys = () => get(activeAlerts).map((alert) => alert.key);

describe('alert rules', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(START);
	});

	afterEach(() => {
		resetAlerts();
		popup.set(null);
		if (get(hearthEditMode)) cancelEdit();
		vi.useRealTimers();
	});

	it('raises an alert once the conditions have held for for_seconds', () => {
		syncRules([fridge], door('on'));
		expect(keys()).toEqual([]);
		vi.advanceTimersByTime(119_000);
		expect(keys()).toEqual([]);
		const wakes = get(wakeScreen);
		vi.advanceTimersByTime(1_000);
		expect(get(activeAlerts)).toMatchObject([
			{ key: 'rule:fridge', title: 'Fridge door open', severity: 'warning', popup: true }
		]);
		expect(get(wakeScreen)).toBe(wakes + 1);
	});

	it('never raises when the conditions stop holding before the delay runs out', () => {
		syncRules([fridge], door('on'));
		vi.advanceTimersByTime(60_000);
		syncRules([fridge], door('off'));
		vi.advanceTimersByTime(120_000);
		expect(keys()).toEqual([]);
	});

	it('counts the time the entity already spent in the state', () => {
		syncRules([fridge], door('on', 100));
		vi.advanceTimersByTime(20_000);
		expect(keys()).toEqual(['rule:fridge']);
	});

	it('times a change it saw live from the browser clock, however far off it is', () => {
		syncRules([fridge], door('off'));
		// the server stamps the change 100 s before what this browser thinks is now
		syncRules([fridge], door('on', 100));
		vi.advanceTimersByTime(119_000);
		expect(keys()).toEqual([]);
		vi.advanceTimersByTime(1_000);
		expect(keys()).toEqual(['rule:fridge']);
	});

	it('starts the wait over when an edit changes the delay or the conditions', () => {
		syncRules([fridge], door('off'));
		syncRules([fridge], door('on'));
		vi.advanceTimersByTime(60_000);
		syncRules([{ ...fridge, for_seconds: 300 }], door('on'));
		vi.advanceTimersByTime(120_000);
		expect(keys()).toEqual([]);
		vi.advanceTimersByTime(180_000);
		expect(keys()).toEqual(['rule:fridge']);

		syncRules([{ ...fridge, for_seconds: 10, title: 'Renamed' }], door('on'));
		expect(keys()).toEqual([]);
		vi.advanceTimersByTime(10_000);
		expect(get(activeAlerts)[0].title).toBe('Renamed');
	});

	it('starts a dismissed rule over when the door closed and reopened while disconnected', () => {
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), alerts: [fridge] });
		health.set('connected');
		const stop = startAlerts(host);
		states.set(door('on'));
		vi.advanceTimersByTime(120_000);
		dismissAlert('rule:fridge');
		expect(keys()).toEqual([]);

		health.set('lost');
		vi.advanceTimersByTime(30_000);
		health.set('connected');
		// the snapshot after the reconnect: closed and opened again 5 s ago
		states.set(door('on', 5));
		expect(keys()).toEqual([]);
		vi.advanceTimersByTime(114_000);
		expect(keys()).toEqual([]);
		vi.advanceTimersByTime(1_000);
		expect(keys()).toEqual(['rule:fridge']);

		stop();
		setAlertHost(host);
		health.set('booting');
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it.each([
		['closed', 'off', []],
		['still open', 'on', ['rule:fridge']]
	])(
		'lets the snapshot decide a delay that ran out while disconnected (door %s)',
		(_label, state, expected) => {
			hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), alerts: [fridge] });
			health.set('connected');
			const stop = startAlerts(host);
			const snapshot = door('on');
			states.set(snapshot);
			health.set('lost');
			vi.advanceTimersByTime(120_000);
			expect(keys()).toEqual([]);

			health.set('connected');
			const entity = snapshot['binary_sensor.fridge_door'];
			states.set({ 'binary_sensor.fridge_door': { ...entity, state } });
			expect(keys()).toEqual(expected);

			stop();
			setAlertHost(host);
			health.set('booting');
			hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		}
	);

	it('counts an attribute condition from the last update, not the last state change', () => {
		syncRules([hot], thermostat(30, 5));
		vi.advanceTimersByTime(114_000);
		expect(keys()).toEqual([]);
		vi.advanceTimersByTime(1_000);
		expect(keys()).toEqual(['rule:hot']);
	});

	it('starts a dismissed attribute rule over when the reading moved while disconnected', () => {
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), alerts: [hot] });
		health.set('connected');
		const stop = startAlerts(host);
		states.set(thermostat(30));
		vi.advanceTimersByTime(120_000);
		dismissAlert('rule:hot');

		health.set('lost');
		vi.advanceTimersByTime(30_000);
		health.set('connected');
		// fell below and rose again 5 s ago; the state itself never changed
		states.set(thermostat(31, 5));
		expect(keys()).toEqual([]);
		vi.advanceTimersByTime(115_000);
		expect(keys()).toEqual(['rule:hot']);

		stop();
		setAlertHost(host);
		health.set('booting');
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('keeps a dismissed rule quiet across a reconnect when nothing changed', () => {
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), alerts: [fridge] });
		health.set('connected');
		const stop = startAlerts(host);
		const snapshot = door('on');
		states.set(snapshot);
		vi.advanceTimersByTime(120_000);
		dismissAlert('rule:fridge');
		health.set('lost');
		health.set('connected');
		states.set({ ...snapshot });
		vi.advanceTimersByTime(300_000);
		expect(keys()).toEqual([]);

		stop();
		setAlertHost(host);
		health.set('booting');
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('opens the popup of an entity rule that fired while editing once editing ends', () => {
		const rule = { ...fridge, for_seconds: undefined, entity: 'binary_sensor.fridge_door' };
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), alerts: [rule] });
		enterEditMode();
		const stop = startAlerts(host);
		states.set(door('on'));
		expect(get(activeAlerts)).toHaveLength(1);
		expect(get(popup)).toBeNull();
		cancelEdit();
		expect(get(popup)?.entity).toBe('binary_sensor.fridge_door');
		stop();
		setAlertHost(host);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('clears the alert when the conditions stop holding', () => {
		syncRules([{ ...fridge, for_seconds: undefined }], door('on'));
		expect(keys()).toEqual(['rule:fridge']);
		syncRules([{ ...fridge, for_seconds: undefined }], door('off'));
		expect(keys()).toEqual([]);
	});

	it('keeps an alert without auto_close until it is dismissed', () => {
		const latched = { ...fridge, for_seconds: undefined, auto_close: false };
		syncRules([latched], door('on'));
		syncRules([latched], door('off'));
		expect(keys()).toEqual(['rule:fridge']);
		dismissAlert('rule:fridge');
		expect(keys()).toEqual([]);
	});

	it('stays quiet after a dismiss until the conditions clear, then arms again', () => {
		const rule = { ...fridge, for_seconds: 10 };
		syncRules([rule], door('on'));
		vi.advanceTimersByTime(10_000);
		dismissAlert('rule:fridge');
		expect(keys()).toEqual([]);
		syncRules([rule], door('on'));
		vi.advanceTimersByTime(60_000);
		expect(keys()).toEqual([]);

		syncRules([rule], door('off'));
		syncRules([rule], door('on'));
		vi.advanceTimersByTime(10_000);
		expect(keys()).toEqual(['rule:fridge']);
	});

	it('opens the entity popup for an entity rule and closes it when the rule clears', () => {
		const rule = { ...fridge, for_seconds: undefined, entity: 'binary_sensor.fridge_door' };
		syncRules([rule], door('on'));
		expect(get(popup)?.entity).toBe('binary_sensor.fridge_door');
		// the popup stands in for the card
		expect(get(activeAlerts)[0].popup).toBe(false);
		syncRules([rule], door('off'));
		expect(get(popup)).toBeNull();
	});

	it('leaves a popup for another entity open when a rule clears', () => {
		const rule = { ...fridge, for_seconds: undefined, entity: 'binary_sensor.fridge_door' };
		syncRules([rule], door('on'));
		popup.set({ kind: 'detail', entity: 'light.desk', name: 'Desk' });
		syncRules([rule], door('off'));
		expect(get(popup)?.entity).toBe('light.desk');
	});

	it('leaves a popup it did not open alone when a rule clears', () => {
		const quiet = {
			...fridge,
			for_seconds: undefined,
			popup: false,
			entity: 'binary_sensor.fridge_door'
		};
		syncRules([quiet], door('on'));
		expect(get(popup)).toBeNull();
		openEntityDetail('binary_sensor.fridge_door');
		syncRules([quiet], door('off'));
		expect(get(popup)?.entity).toBe('binary_sensor.fridge_door');
	});

	it('leaves the entity popup open when the user opened it again after the rule did', () => {
		const rule = { ...fridge, for_seconds: undefined, entity: 'binary_sensor.fridge_door' };
		syncRules([rule], door('on'));
		popup.set(null);
		openEntityDetail('binary_sensor.fridge_door');
		syncRules([rule], door('off'));
		expect(get(popup)?.entity).toBe('binary_sensor.fridge_door');
	});

	it('does not pop anything up while editing', () => {
		enterEditMode();
		const rule = { ...fridge, for_seconds: undefined, entity: 'binary_sensor.fridge_door' };
		syncRules([rule], door('on'));
		expect(get(popup)).toBeNull();
		expect(keys()).toEqual(['rule:fridge']);
	});

	it('drops the alert of a rule that was removed from the configuration', () => {
		syncRules([{ ...fridge, for_seconds: undefined }], door('on'));
		syncRules([], door('on'));
		expect(keys()).toEqual([]);
	});

	it('never raises a rule without conditions', () => {
		syncRules([{ ...fridge, conditions: [], for_seconds: undefined }], door('on'));
		expect(keys()).toEqual([]);
	});
});

describe('alert rules that read the clock or the device', () => {
	afterEach(() => {
		resetAlerts();
		deviceName.set('');
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		vi.useRealTimers();
	});

	it('raises a time rule when the minute it waits for comes round', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-02T21:59:30'));
		const night: AlertRule = {
			id: 'night',
			title: 'Night mode',
			severity: 'info',
			conditions: [{ time: { after: '22:00', before: '06:00' } }]
		};
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), alerts: [night] });
		health.set('connected');
		const stop = startAlerts(host);
		states.set({});
		expect(keys()).toEqual([]);
		vi.advanceTimersByTime(31_000);
		expect(keys()).toEqual(['rule:night']);
		stop();
		setAlertHost(host);
	});

	it('follows the device name of this screen', () => {
		const here: AlertRule = {
			id: 'here',
			title: 'Kitchen only',
			severity: 'info',
			conditions: [{ device: 'kitchen' }]
		};
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), alerts: [here] });
		health.set('connected');
		const stop = startAlerts(host);
		states.set({});
		expect(keys()).toEqual([]);
		deviceName.set('kitchen');
		expect(keys()).toEqual(['rule:here']);
		stop();
		setAlertHost(host);
	});

	it('after a reload, waits from when a time window opened, not from the entity change', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-02T22:01:00'));
		const lateDoor: AlertRule = {
			...fridge,
			id: 'late-door',
			for_seconds: 300,
			conditions: [...fridge.conditions, { time: { after: '22:00', before: '06:00' } }]
		};
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), alerts: [lateDoor] });
		health.set('connected');
		// the first states after the reload: open for ten minutes, but the
		// window has been open for one
		states.set(door('on', 600));
		const stop = startAlerts(host);
		expect(keys()).toEqual([]);
		vi.advanceTimersByTime(239_000);
		expect(keys()).toEqual([]);
		vi.advanceTimersByTime(1_000);
		expect(keys()).toEqual(['rule:late-door']);
		stop();
		setAlertHost(host);
	});

	it('after a reload, waits the full delay for a device condition', () => {
		vi.useFakeTimers();
		vi.setSystemTime(START);
		deviceName.set('kitchen');
		const here: AlertRule = {
			...fridge,
			id: 'here',
			for_seconds: 60,
			conditions: [...fridge.conditions, { device: 'kitchen' }]
		};
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), alerts: [here] });
		health.set('connected');
		states.set(door('on', 600));
		const stop = startAlerts(host);
		vi.advanceTimersByTime(59_000);
		expect(keys()).toEqual([]);
		vi.advanceTimersByTime(1_000);
		expect(keys()).toEqual(['rule:here']);
		stop();
		setAlertHost(host);
	});
});

describe('HEARTH events', () => {
	afterEach(() => {
		resetAlerts();
		popup.set(null);
		screensaverPreview.set(false);
		if (get(hearthEditMode)) cancelEdit();
	});

	it('reads navigate, wake and sleep', () => {
		expect(parseHearthEvent({ action: 'navigate', page: ' cameras ' }, '')).toEqual({
			action: 'navigate',
			page: 'cameras'
		});
		expect(
			parseHearthEvent({ action: 'navigate', navigation_path: '/lovelace/cameras' }, '')
		).toEqual({ action: 'navigate', page: '/lovelace/cameras' });
		expect(parseHearthEvent({ action: 'navigate' }, '')).toBeNull();
		expect(parseHearthEvent({ action: 'wake' }, '')).toEqual({ action: 'wake' });
		expect(parseHearthEvent({ action: 'sleep' }, '')).toEqual({ action: 'sleep' });
	});

	it('targets navigate, wake and sleep at one device like every other action', () => {
		for (const event of [
			{ action: 'navigate', page: 'cameras' },
			{ action: 'wake' },
			{ action: 'sleep' }
		]) {
			expect(parseHearthEvent({ ...event, device: 'hall' }, 'hall')).not.toBeNull();
			expect(parseHearthEvent({ ...event, device: ['hall', 'kitchen'] }, 'kitchen')).not.toBeNull();
			expect(parseHearthEvent({ ...event, device: 'hall' }, 'kitchen')).toBeNull();
		}
	});

	it('shows the page a navigate event names, by id or by name', () => {
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			rooms: [
				{ id: 'home', name: 'Home', icon: 'home', cards: [[]] },
				{ id: 'cameras', name: 'Front cameras', icon: 'videocam', cards: [[]] }
			]
		});
		currentRoom.set('home');
		handleHearthAction({ action: 'navigate', page: 'Front cameras' });
		expect(get(currentRoom)).toBe('cameras');
		handleHearthAction({ action: 'navigate', page: 'home' });
		expect(get(currentRoom)).toBe('home');
		handleHearthAction({ action: 'navigate', page: 'garage' });
		expect(get(currentRoom)).toBe('home');
		enterEditMode();
		handleHearthAction({ action: 'navigate', page: 'cameras' });
		expect(get(currentRoom)).toBe('home');
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('wakes the screen and starts the sleep screen', () => {
		const before = get(wakeScreen);
		handleHearthAction({ action: 'wake' });
		expect(get(wakeScreen)).toBe(before + 1);
		handleHearthAction({ action: 'sleep' });
		expect(get(screensaverPreview)).toBe(true);
		screensaverPreview.set(false);
		enterEditMode();
		handleHearthAction({ action: 'sleep' });
		expect(get(screensaverPreview)).toBe(false);
	});

	it('leaves an alert popup, This screen and setup uncovered by sleep', () => {
		handleHearthAction({
			action: 'alert',
			tag: 'w',
			title: 'Washer',
			severity: 'info',
			popup: true
		});
		handleHearthAction({ action: 'sleep' });
		expect(get(screensaverPreview)).toBe(false);
		// one only listed in the notifications widget covers nothing
		handleHearthAction({ action: 'dismiss_alert', tag: 'w' });
		handleHearthAction({
			action: 'alert',
			tag: 'q',
			title: 'Quiet',
			severity: 'info',
			popup: false
		});
		sleepBlocked = true;
		handleHearthAction({ action: 'sleep' });
		expect(get(screensaverPreview)).toBe(false);
		sleepBlocked = false;
		handleHearthAction({ action: 'sleep' });
		expect(get(screensaverPreview)).toBe(true);
	});

	it('does not navigate to a page its visibility conditions hide', () => {
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			rooms: [
				{ id: 'home', name: 'Home', icon: 'home', cards: [[]] },
				{ id: 'kitchen', name: 'Kitchen', icon: 'kitchen', cards: [[]] },
				{
					id: 'night',
					name: 'Night',
					icon: 'bedtime',
					visibility: [{ entity: 'input_boolean.night', state: 'on' }],
					cards: [[]]
				}
			]
		});
		states.set({ 'input_boolean.night': hassEntity('input_boolean.night', 'off') });
		currentRoom.set('kitchen');
		handleHearthAction({ action: 'navigate', page: 'night' });
		expect(get(currentRoom)).toBe('kitchen');
		states.set({ 'input_boolean.night': hassEntity('input_boolean.night', 'on') });
		handleHearthAction({ action: 'navigate', page: 'night' });
		expect(get(currentRoom)).toBe('night');
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('reads an alert with defaults for what it leaves out', () => {
		expect(parseHearthEvent({ action: 'alert', title: ' Washer done ' }, '')).toEqual({
			action: 'alert',
			tag: 'Washer done',
			title: 'Washer done',
			message: undefined,
			icon: undefined,
			severity: 'info',
			popup: true,
			entity: undefined
		});
		expect(
			parseHearthEvent(
				{ action: 'alert', tag: 'washer', title: 'Done', severity: 'critical', popup: false },
				''
			)
		).toMatchObject({ tag: 'washer', severity: 'critical', popup: false });
	});

	it('accepts every severity a rule can have', () => {
		for (const severity of ALERT_SEVERITIES) {
			expect(parseHearthEvent({ action: 'alert', title: 'A', severity }, '')).toMatchObject({
				severity
			});
		}
	});

	it('ignores what it cannot act on', () => {
		expect(parseHearthEvent({ action: 'alert' }, '')).toBeNull();
		expect(parseHearthEvent({ action: 'dismiss_alert' }, '')).toBeNull();
		expect(parseHearthEvent({ action: 'open_popup' }, '')).toBeNull();
		expect(parseHearthEvent({ action: 'launch' }, '')).toBeNull();
		expect(parseHearthEvent({ event: 'refresh' }, '')).toBeNull();
	});

	it('only acts on events for this device when they name one', () => {
		const event = { action: 'close_popup', device: 'kitchen' };
		expect(parseHearthEvent(event, 'kitchen')).toEqual({ action: 'close_popup' });
		expect(parseHearthEvent(event, 'hall')).toBeNull();
		expect(parseHearthEvent(event, '')).toBeNull();
		expect(parseHearthEvent({ ...event, device: ['hall', 'kitchen'] }, 'kitchen')).not.toBeNull();
		expect(parseHearthEvent({ action: 'close_popup' }, 'hall')).not.toBeNull();
	});

	it('reaches no screen with an empty device name or list', () => {
		for (const device of ['', '  ', [], ['', ' ']]) {
			expect(parseHearthEvent({ action: 'wake', device }, '')).toBeNull();
			expect(parseHearthEvent({ action: 'wake', device }, 'hall')).toBeNull();
		}
	});

	it('raises, replaces and dismisses event alerts by tag', () => {
		handleHearthAction(parseHearthEvent({ action: 'alert', tag: 'w', title: 'One' }, '')!);
		handleHearthAction(parseHearthEvent({ action: 'alert', tag: 'w', title: 'Two' }, '')!);
		expect(get(activeAlerts)).toMatchObject([{ key: 'event:w', title: 'Two' }]);
		handleHearthAction(parseHearthEvent({ action: 'dismiss_alert', tag: 'w' }, '')!);
		expect(get(activeAlerts)).toEqual([]);
	});

	it('dismisses an event alert on this screen', () => {
		handleHearthAction(parseHearthEvent({ action: 'alert', tag: 'w', title: 'One' }, '')!);
		dismissAlert('event:w');
		expect(get(activeAlerts)).toEqual([]);
	});

	it('opens a popup and closes only the one it names', () => {
		handleHearthAction(parseHearthEvent({ action: 'open_popup', entity: 'light.desk' }, '')!);
		expect(get(popup)?.entity).toBe('light.desk');
		handleHearthAction(parseHearthEvent({ action: 'close_popup', entity: 'light.shelf' }, '')!);
		expect(get(popup)?.entity).toBe('light.desk');
		handleHearthAction(parseHearthEvent({ action: 'close_popup', entity: 'light.desk' }, '')!);
		expect(get(popup)).toBeNull();
		handleHearthAction(parseHearthEvent({ action: 'open_popup', entity: 'light.desk' }, '')!);
		handleHearthAction(parseHearthEvent({ action: 'close_popup' }, '')!);
		expect(get(popup)).toBeNull();
	});
});

describe('alert chimes', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(START);
		vi.mocked(playAlertChime).mockClear();
	});

	afterEach(() => {
		resetAlerts();
		popup.set(null);
		if (get(hearthEditMode)) cancelEdit();
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		vi.useRealTimers();
	});

	it('chimes once when a rule fires, with the rule tone at the set volume', () => {
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			alert_chimes: { warning: 'soft', volume: 30 }
		});
		syncRules([{ ...fridge, chime: 'bell' }], door('on'));
		expect(playAlertChime).not.toHaveBeenCalled();
		vi.advanceTimersByTime(120_000);
		expect(playAlertChime).toHaveBeenCalledExactlyOnceWith('bell', 30);
		syncRules([{ ...fridge, chime: 'bell' }], door('on'));
		expect(playAlertChime).toHaveBeenCalledOnce();
	});

	it('falls back to the severity chime and stays silent without one', () => {
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			alert_chimes: { warning: true }
		});
		syncRules([{ ...fridge, for_seconds: undefined }], door('on'));
		expect(playAlertChime).toHaveBeenCalledWith('chime', undefined);
		resetAlerts();
		vi.mocked(playAlertChime).mockClear();
		syncRules([{ ...fridge, severity: 'info', for_seconds: undefined }], door('on'));
		expect(playAlertChime).not.toHaveBeenCalled();
	});

	it('chimes for an alert Home Assistant raises', () => {
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			alert_chimes: { critical: 'bell' }
		});
		handleHearthAction({
			action: 'alert',
			tag: 'smoke',
			title: 'Smoke',
			severity: 'critical',
			popup: true
		});
		expect(playAlertChime).toHaveBeenCalledWith('bell', undefined);
	});

	it('chimes for a new tag only, in the tone the event names', () => {
		const smoke = {
			action: 'alert' as const,
			tag: 'smoke',
			title: 'Smoke',
			severity: 'info' as const,
			popup: true
		};
		handleHearthAction({ ...smoke, chime: 'soft' });
		handleHearthAction({ ...smoke, title: 'Smoke in the kitchen', chime: 'soft' });
		expect(playAlertChime).toHaveBeenCalledExactlyOnceWith('soft', undefined);
		expect(parseHearthEvent({ action: 'alert', title: 'Smoke', chime: 'bell' }, '')).toMatchObject({
			chime: 'bell'
		});
		expect(parseHearthEvent({ action: 'alert', title: 'Smoke', chime: false }, '')).toMatchObject({
			chime: 'none'
		});
	});

	it('stays silent while editing', () => {
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			alert_chimes: { warning: true }
		});
		enterEditMode();
		syncRules([{ ...fridge, for_seconds: undefined }], door('on'));
		expect(playAlertChime).not.toHaveBeenCalled();
	});
});
