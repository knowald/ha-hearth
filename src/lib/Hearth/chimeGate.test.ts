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

const created: { resume: ReturnType<typeof vi.fn> }[] = [];

class FakeAudioContext {
	resume = vi.fn(() => Promise.resolve());
	close = vi.fn(() => Promise.resolve());
	constructor() {
		created.push(this);
	}
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
		vi.mocked(playChime).mockClear();
		vi.stubGlobal('AudioContext', FakeAudioContext);
	});

	afterEach(() => {
		resetChimes();
		setScreenOverride('mute_chimes', undefined);
		vi.unstubAllGlobals();
	});

	it('skips a chime before anyone has touched the page', async () => {
		armChimes();
		expect(await playAlertChime('chime')).toBe(false);
		expect(playChime).not.toHaveBeenCalled();
		expect(created).toHaveLength(0);
	});

	it('unlocks audio on the first tap and plays from then on at the set volume', async () => {
		armChimes();
		window.dispatchEvent(new Event('pointerdown'));
		expect(chimesUnlocked()).toBe(true);
		expect(created[0].resume).toHaveBeenCalled();
		expect(await playAlertChime('bell', 40)).toBe(true);
		expect(playChime).toHaveBeenCalledWith(created[0], 'bell', 0.4);
		// later taps leave the one context alone
		window.dispatchEvent(new Event('pointerdown'));
		expect(created).toHaveLength(1);
	});

	it('unlocks on a key press too', () => {
		armChimes();
		window.dispatchEvent(new Event('keydown'));
		expect(chimesUnlocked()).toBe(true);
	});

	it('stays silent on a screen that muted chimes', async () => {
		armChimes();
		window.dispatchEvent(new Event('pointerdown'));
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
		window.dispatchEvent(new Event('pointerdown'));
		expect(chimesUnlocked()).toBe(false);
		expect(await playAlertChime('chime')).toBe(false);
	});
});
