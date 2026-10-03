import { writable } from 'svelte/store';
import { MOTION } from '$lib/core/theme';

/** Non-zero enables motion, 0 disables it; durations come from MOTION. */
export const motion = writable<number>(MOTION.base);

/**
 * motion:false in configuration.yaml disables transitions app-wide, and so
 * does the OS reduced-motion setting unless motion is explicitly true.
 */
export function motionLevel(setting: boolean | undefined, prefersReduced: boolean): number {
	return setting === false || (prefersReduced && setting !== true) ? 0 : MOTION.base;
}
