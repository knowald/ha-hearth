import { derived } from 'svelte/store';
import type { HassEntity } from 'home-assistant-js-websocket';
import { motion } from '$lib/core/app/motion';
import { hearthConfig } from './store';

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

const SLOWEST_TURN = 3;
const FASTEST_TURN = 0.6;
const UNKNOWN_SPEED_TURN = 1.6;

/** Seconds per fan turn: a faster fan turns its icon faster. */
export function fanTurnSeconds(percentage: unknown): number {
	if (typeof percentage !== 'number' || !Number.isFinite(percentage) || percentage <= 0) {
		return UNKNOWN_SPEED_TURN;
	}
	const share = Math.min(100, percentage) / 100;
	return Math.round((SLOWEST_TURN - (SLOWEST_TURN - FASTEST_TURN) * share) * 100) / 100;
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
