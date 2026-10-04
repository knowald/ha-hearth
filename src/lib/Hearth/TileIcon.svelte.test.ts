import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { motion } from '$lib/core/app/motion';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { MOTION } from '$lib/core/theme';
import { DEFAULT_HEARTH_CONFIG } from './config';
import EntityTile from './EntityTile.svelte';
import { hearthConfig } from './store';

function iconMotion(container: HTMLElement) {
	return container.querySelector<HTMLElement>('[data-icon-motion]');
}

describe('tile icon animations', () => {
	afterEach(() => {
		motion.set(MOTION.base);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('spins the icon of a fan that is on, timed by its speed', () => {
		states.set({ 'fan.bed': hassEntity('fan.bed', 'on', { percentage: 100 }) });
		const { container } = render(EntityTile, { entity: 'fan.bed' });
		const icon = iconMotion(container);
		expect(icon?.dataset.iconMotion).toBe('spin');
		expect(icon?.style.getPropertyValue('--icon-turn')).toBe('0.6s');
	});

	it('keeps the icon still once the fan is off', () => {
		states.set({ 'fan.bed': hassEntity('fan.bed', 'off') });
		const { container } = render(EntityTile, { entity: 'fan.bed' });
		expect(iconMotion(container)).toBeNull();
	});

	it('glows a colored light in its color', () => {
		states.set({
			'light.strip': hassEntity('light.strip', 'on', {
				brightness: 200,
				color_mode: 'hs',
				rgb_color: [255, 160, 51]
			})
		});
		const { container } = render(EntityTile, { entity: 'light.strip' });
		const icon = iconMotion(container);
		expect(icon?.dataset.iconMotion).toBe('glow');
		expect(icon?.style.getPropertyValue('--icon-glow')).toBe('rgb(255, 160, 51)');
	});

	it('draws level bars beside a playing media player', () => {
		states.set({ 'media_player.living': hassEntity('media_player.living', 'playing') });
		const { container } = render(EntityTile, { entity: 'media_player.living' });
		expect(iconMotion(container)?.dataset.iconMotion).toBe('bars');
		expect(container.querySelectorAll('.bars span')).toHaveLength(3);
	});

	it('stays still under reduced motion', () => {
		motion.set(0);
		states.set({ 'fan.bed': hassEntity('fan.bed', 'on', { percentage: 50 }) });
		const { container } = render(EntityTile, { entity: 'fan.bed' });
		expect(iconMotion(container)).toBeNull();
	});

	it('stays still with animations turned off', () => {
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), animations: false });
		states.set({ 'vacuum.robo': hassEntity('vacuum.robo', 'cleaning') });
		const { container } = render(EntityTile, { entity: 'vacuum.robo' });
		expect(iconMotion(container)).toBeNull();
	});

	it('keeps an unavailable entity still', () => {
		states.set({ 'media_player.living': hassEntity('media_player.living', 'unavailable') });
		const { container } = render(EntityTile, { entity: 'media_player.living' });
		expect(iconMotion(container)).toBeNull();
	});
});
