import { describe, expect, it } from 'vitest';
import { MOTION } from '$lib/core/theme';
import { motionLevel } from './motion';

describe('motionLevel', () => {
	it('follows the OS setting when the configuration leaves motion unset', () => {
		expect(motionLevel(undefined, false)).toBe(MOTION.base);
		expect(motionLevel(undefined, true)).toBe(0);
	});

	it('lets an explicit setting win over the OS', () => {
		expect(motionLevel(false, false)).toBe(0);
		expect(motionLevel(true, true)).toBe(MOTION.base);
	});
});
