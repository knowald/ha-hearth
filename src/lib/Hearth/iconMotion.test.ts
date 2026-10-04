import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import { motion } from '$lib/core/app/motion';
import { hassEntity } from '$lib/core/ha/testing';
import { MOTION } from '$lib/core/theme';
import { DEFAULT_HEARTH_CONFIG } from './config';
import { fanTurnSeconds, iconMotionEnabled, iconMotionFor } from './iconMotion';
import { hearthConfig } from './store';

describe('iconMotionFor', () => {
	it('spins a fan that is on, faster at a higher speed', () => {
		expect(iconMotionFor(hassEntity('fan.bed', 'on', { percentage: 100 }))).toEqual({
			kind: 'spin',
			duration: '0.6s'
		});
		expect(iconMotionFor(hassEntity('fan.bed', 'on', { percentage: 50 }))).toEqual({
			kind: 'spin',
			duration: '1.8s'
		});
		expect(iconMotionFor(hassEntity('fan.bed', 'off', { percentage: 50 }))).toBeUndefined();
	});

	it('turns a fan without a known speed at a middle pace', () => {
		expect(fanTurnSeconds(undefined)).toBe(1.6);
		expect(fanTurnSeconds(0)).toBe(1.6);
		expect(fanTurnSeconds(250)).toBe(0.6);
	});

	it('sways a vacuum only while it cleans', () => {
		expect(iconMotionFor(hassEntity('vacuum.robo', 'cleaning'))).toEqual({ kind: 'sway' });
		expect(iconMotionFor(hassEntity('vacuum.robo', 'docked'))).toBeUndefined();
	});

	it('gives a light that is on a glow in its own color or the accent', () => {
		expect(iconMotionFor(hassEntity('light.strip', 'on'), 'rgb(255, 160, 51)')).toEqual({
			kind: 'glow',
			color: 'rgb(255, 160, 51)'
		});
		expect(iconMotionFor(hassEntity('light.desk', 'on'), null)?.color).toBe(
			'rgb(var(--h-accent-rgb))'
		);
		expect(iconMotionFor(hassEntity('light.desk', 'off'))).toBeUndefined();
	});

	it('shows level bars on a playing media player', () => {
		expect(iconMotionFor(hassEntity('media_player.living', 'playing'))).toEqual({ kind: 'bars' });
		expect(iconMotionFor(hassEntity('media_player.living', 'paused'))).toBeUndefined();
	});

	it('pulses a climate entity while it is heating or cooling, not merely set to heat', () => {
		expect(iconMotionFor(hassEntity('climate.hall', 'heat', { hvac_action: 'heating' }))).toEqual({
			kind: 'pulse'
		});
		expect(iconMotionFor(hassEntity('climate.hall', 'cool', { hvac_action: 'cooling' }))).toEqual({
			kind: 'pulse'
		});
		expect(
			iconMotionFor(hassEntity('climate.hall', 'heat', { hvac_action: 'idle' }))
		).toBeUndefined();
	});

	it('leaves other domains still', () => {
		expect(iconMotionFor(hassEntity('switch.fan', 'on'))).toBeUndefined();
		expect(iconMotionFor(undefined)).toBeUndefined();
	});
});

describe('iconMotionEnabled', () => {
	afterEach(() => {
		motion.set(MOTION.base);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('is on by default', () => {
		expect(get(iconMotionEnabled)).toBe(true);
	});

	it('is off under reduced motion', () => {
		motion.set(0);
		expect(get(iconMotionEnabled)).toBe(false);
	});

	it('is off when the dashboard turns animations off', () => {
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), animations: false });
		expect(get(iconMotionEnabled)).toBe(false);
	});
});
