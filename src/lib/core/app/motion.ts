import { writable } from 'svelte/store';
import { MOTION } from '$lib/core/theme';

/** Non-zero enables motion, 0 disables it; durations come from MOTION. */
export const motion = writable<number>(MOTION.base);
