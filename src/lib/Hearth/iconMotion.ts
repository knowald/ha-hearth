import { derived } from 'svelte/store';
import type { HassEntity } from 'home-assistant-js-websocket';
import { motion } from '$lib/core/app/motion';
import { hearthConfig, hearthEditMode, screensaverActive } from './store';

/*
 * Tile icon micro-animations. The kind picks a CSS animation in TileIcon; this
 * module only decides which one an entity earns right now, so the motion
 * itself never runs a script.
 */

export type IconMotionKind = 'spin' | 'sway' | 'glow' | 'bars' | 'pulse';

export interface IconMotion {
	kind: IconMotionKind;
	/** One fan turn, as a CSS time. */
	duration?: string;
	/** Glow color, as a CSS color. */
	color?: string;
}

/*
 * Seconds per fan turn by speed bucket. A few steps rather than a smooth
 * scale: every new duration restarts the CSS animation, which would jump the
 * icon on each small speed change.
 */
const TURN_SECONDS = { slow: 2.4, medium: 1.6, fast: 0.9 } as const;

/** Seconds per fan turn: a faster fan turns its icon faster. */
export function fanTurnSeconds(percentage: unknown): number {
	if (typeof percentage !== 'number' || !Number.isFinite(percentage) || percentage <= 0) {
		return TURN_SECONDS.medium;
	}
	if (percentage <= 33) return TURN_SECONDS.slow;
	return percentage <= 66 ? TURN_SECONDS.medium : TURN_SECONDS.fast;
}

/**
 * The animation an entity's tile icon plays, or undefined for a still icon.
 * `lightColor` is the light's own color from lightViewFor, null for white.
 */
export function iconMotionFor(
	entity: HassEntity | undefined,
	lightColor?: string | null
): IconMotion | undefined {
	if (!entity) return undefined;
	const domain = entity.entity_id.split('.')[0];
	switch (domain) {
		case 'fan':
			return entity.state === 'on'
				? { kind: 'spin', duration: `${fanTurnSeconds(entity.attributes?.percentage)}s` }
				: undefined;
		case 'vacuum':
			return entity.state === 'cleaning' ? { kind: 'sway' } : undefined;
		case 'light':
			return entity.state === 'on'
				? { kind: 'glow', color: lightColor ?? 'rgb(var(--h-accent-rgb))' }
				: undefined;
		case 'media_player':
			return entity.state === 'playing' ? { kind: 'bars' } : undefined;
		case 'climate': {
			// the mode says what it may do; hvac_action says what it is doing now
			const action = entity.attributes?.hvac_action;
			return action === 'heating' || action === 'cooling' ? { kind: 'pulse' } : undefined;
		}
		default:
			return undefined;
	}
}

/** Off with reduced motion, from the OS, configuration.yaml or This screen, or with `animations: false`. */
export const iconMotionEnabled = derived(
	[hearthConfig, motion],
	([$config, $motion]) => $config.animations !== false && $motion > 0
);

/** Running tile animations hold still while nobody sees them move or they distract from editing. */
export const iconMotionPaused = derived(
	[screensaverActive, hearthEditMode],
	([$sleeping, $editing]) => $sleeping || $editing
);
