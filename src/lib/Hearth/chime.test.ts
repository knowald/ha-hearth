import { describe, expect, it, vi } from 'vitest';
import { CHIME_NOTES, playChime } from './chime';

function fakeContext(currentTime = 10) {
	const oscillators: {
		type: string;
		frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
		connect: ReturnType<typeof vi.fn>;
		start: ReturnType<typeof vi.fn>;
		stop: ReturnType<typeof vi.fn>;
	}[] = [];
	const gains: {
		gain: {
			setValueAtTime: ReturnType<typeof vi.fn>;
			exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
		};
		connect: ReturnType<typeof vi.fn>;
	}[] = [];
	const destination = {};
	const context = {
		currentTime,
		destination,
		createOscillator: () => {
			const oscillator = {
				type: 'sine',
				frequency: { setValueAtTime: vi.fn() },
				connect: vi.fn(),
				start: vi.fn(),
				stop: vi.fn()
			};
			oscillators.push(oscillator);
			return oscillator;
		},
		createGain: () => {
			const gain = {
				gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
				connect: vi.fn()
			};
			gains.push(gain);
			return gain;
		}
	};
	return { context: context as unknown as AudioContext, oscillators, gains, destination };
}

describe('playChime', () => {
	it('schedules one oscillator per note, starting just after now and in order', () => {
		const { context, oscillators, gains, destination } = fakeContext(10);
		const end = playChime(context, 'chime', 1);
		expect(oscillators).toHaveLength(CHIME_NOTES.chime.length);
		const [first, second] = oscillators;
		expect(first.frequency.setValueAtTime).toHaveBeenCalledWith(659.25, 10.02);
		expect(first.start).toHaveBeenCalledWith(10.02);
		expect(second.start.mock.calls[0][0]).toBeCloseTo(10.3);
		expect(first.connect).toHaveBeenCalledWith(gains[0]);
		expect(gains[0].connect).toHaveBeenCalledWith(destination);
		// the second note's fade sets the end
		expect(end).toBeCloseTo(10.02 + 0.28 + 0.8);
	});

	it('scales each note by the volume and fades it out', () => {
		const { context, gains } = fakeContext(0);
		playChime(context, 'soft', 0.5);
		const ramps = gains[0].gain.exponentialRampToValueAtTime.mock.calls;
		expect(ramps[0][0]).toBeCloseTo(0.15);
		expect(ramps[1][0]).toBeCloseTo(0.0001);
		expect(ramps[1][1]).toBeCloseTo(0.02 + 0.7);
	});

	it('keeps a muted volume above zero, which exponential ramps cannot reach', () => {
		const { context, gains } = fakeContext(0);
		playChime(context, 'bell', 0);
		for (const gain of gains) {
			expect(gain.gain.exponentialRampToValueAtTime.mock.calls[0][0]).toBeGreaterThan(0);
		}
	});
});
