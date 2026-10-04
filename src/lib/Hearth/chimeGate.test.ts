import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setScreenOverride } from '$lib/core/app/screen';
import {
	armChimes,
	chimesConfigured,
	chimesUnlocked,
	chimeTone,
	playAlertChime,
	previewChime,
	resetChimes
} from './chimeGate';
import type { AlertRule } from './types';

vi.mock('./chime', () => ({ playChime: vi.fn(() => 0) }));
import { playChime } from './chime';

const created: FakeAudioContext[] = [];
// whether resume() starts the context, as it does inside a gesture
let resumable = true;

class FakeAudioContext {
	state: AudioContextState | 'interrupted' = 'suspended';
	currentTime = 0;
	onstatechange: (() => void) | null = null;
	resume = vi.fn(async () => {
		if (resumable) this.change('running');
	});
	suspend = vi.fn(async () => this.change('suspended'));
	close = vi.fn(() => Promise.resolve());
	constructor() {
		created.push(this);
	}
	change(state: FakeAudioContext['state']) {
		this.state = state;
		this.onstatechange?.();
	}
}

async function tap(event = 'pointerup') {
	window.dispatchEvent(new Event(event));
	await vi.waitFor(() => expect(chimesUnlocked()).toBe(true));
}

const rule = (chime?: AlertRule['chime']): AlertRule => ({
	id: 'door',
	title: 'Door',
	severity: 'info',
	conditions: [{ entity: 'binary_sensor.door', state: 'on' }],
	chime
});

describe('chimeTone', () => {
	it('prefers the rule, then the severity, and plays nothing without either', () => {
		expect(chimeTone('bell', 'info', { info: 'soft' })).toBe('bell');
		expect(chimeTone(undefined, 'warning', { warning: true })).toBe('chime');
		expect(chimeTone(undefined, 'critical', { warning: true })).toBeUndefined();
		expect(chimeTone('none', 'critical', { critical: 'bell' })).toBeUndefined();
	});
});

describe('chimesConfigured', () => {
	it('is false while every chime is unset or none', () => {
		expect(chimesConfigured(undefined, undefined)).toBe(false);
		expect(chimesConfigured([rule('none')], { info: 'none', volume: 40 })).toBe(false);
	});

	it('is true once a rule or a severity names a tone', () => {
		expect(chimesConfigured([rule('soft')], undefined)).toBe(true);
		expect(chimesConfigured([], { critical: true })).toBe(true);
	});
});

describe('the autoplay gate', () => {
	beforeEach(() => {
		created.length = 0;
		resumable = true;
		vi.mocked(playChime).mockClear();
		vi.mocked(playChime).mockReturnValue(0.5);
		vi.stubGlobal('AudioContext', FakeAudioContext);
	});

	afterEach(() => {
		resetChimes();
		setScreenOverride('mute_chimes', undefined);
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('skips a chime before anyone has touched the page', async () => {
		armChimes();
		expect(await playAlertChime('chime')).toBe(false);
		expect(playChime).not.toHaveBeenCalled();
		expect(created).toHaveLength(0);
	});

	it('ignores the start of a touch, which iOS does not count', () => {
		armChimes();
		window.dispatchEvent(new Event('pointerdown'));
		expect(created).toHaveLength(0);
	});

	it.each(['pointerup', 'touchend', 'click', 'keydown'])('unlocks audio on %s', async (event) => {
		armChimes();
		await tap(event);
		expect(created[0].state).toBe('running');
	});

	it('plays at the set volume once unlocked, with one context for every tap', async () => {
		armChimes();
		await tap();
		expect(await playAlertChime('bell', 40)).toBe(true);
		expect(playChime).toHaveBeenCalledWith(created[0], 'bell', 0.4);
		window.dispatchEvent(new Event('pointerup'));
		expect(created).toHaveLength(1);
	});

	it('keeps listening while a tap fails to start the context', async () => {
		armChimes();
		resumable = false;
		window.dispatchEvent(new Event('pointerup'));
		await Promise.resolve();
		expect(chimesUnlocked()).toBe(false);
		resumable = true;
		await tap();
	});

	it('suspends the context once a chime has played and resumes it for the next', async () => {
		vi.useFakeTimers();
		armChimes();
		await tap();
		const audio = created[0];
		await vi.advanceTimersByTimeAsync(600);
		expect(audio.state).toBe('suspended');
		expect(await playAlertChime('soft')).toBe(true);
		expect(audio.resume).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(900);
		expect(audio.state).toBe('running');
		await vi.advanceTimersByTimeAsync(200);
		expect(audio.state).toBe('suspended');
	});

	it('plays at most one chime a second', async () => {
		vi.useFakeTimers();
		armChimes();
		await tap();
		expect(await playAlertChime('chime')).toBe(true);
		expect(await playAlertChime('bell')).toBe(false);
		await vi.advanceTimersByTimeAsync(1000);
		expect(await playAlertChime('bell')).toBe(true);
	});

	it('waits for a tap again after the system interrupts audio', async () => {
		armChimes();
		await tap();
		resumable = false;
		created[0].change('interrupted');
		expect(await playAlertChime('chime')).toBe(false);
		resumable = true;
		window.dispatchEvent(new Event('touchend'));
		await vi.waitFor(() => expect(created[0].state).toBe('running'));
		expect(created).toHaveLength(1);
	});

	it('stays silent on a screen that muted chimes', async () => {
		armChimes();
		await tap();
		setScreenOverride('mute_chimes', true);
		expect(await playAlertChime('chime')).toBe(false);
		expect(playChime).not.toHaveBeenCalled();
	});

	it('plays a preview straight from the settings tap', async () => {
		expect(await previewChime('soft', 80)).toBe(true);
		expect(playChime).toHaveBeenCalledWith(created[0], 'soft', 0.8);
	});

	it('cannot unlock without WebAudio', async () => {
		vi.stubGlobal('AudioContext', undefined);
		armChimes();
		window.dispatchEvent(new Event('pointerup'));
		await Promise.resolve();
		expect(chimesUnlocked()).toBe(false);
		expect(await playAlertChime('chime')).toBe(false);
	});
});
