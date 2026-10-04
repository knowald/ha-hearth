import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { photoRound, startSlideshow } from './photos';

const PHOTOS = ['a', 'b', 'c', 'd'];

// a fixed stream of draws, so a shuffle is repeatable
function draws(...values: number[]) {
	let index = 0;
	return () => values[index++ % values.length];
}

describe('photoRound', () => {
	it('keeps the configured order in sequence', () => {
		expect(photoRound(PHOTOS, 'sequence', 'd', draws(0))).toEqual(PHOTOS);
	});

	it('shuffles every photo exactly once', () => {
		const round = photoRound(PHOTOS, 'shuffle', undefined, draws(0.1, 0.9, 0.5));
		expect(round).not.toEqual(PHOTOS);
		expect([...round].sort()).toEqual(PHOTOS);
	});

	it('never opens a shuffled round with the photo that closed the last one', () => {
		for (let seed = 0; seed < 20; seed += 1) {
			const round = photoRound(PHOTOS, 'shuffle', 'a', draws(seed / 20, ((seed * 7) % 20) / 20));
			expect(round[0]).not.toBe('a');
			expect([...round].sort()).toEqual(PHOTOS);
		}
	});

	it('leaves the list it was given alone', () => {
		const photos = [...PHOTOS];
		photoRound(photos, 'shuffle', undefined, draws(0));
		expect(photos).toEqual(PHOTOS);
	});
});

describe('startSlideshow', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('shows each photo for its seconds and names the one to load ahead', () => {
		const onshow = vi.fn();
		const slideshow = startSlideshow(['a', 'b', 'c'], { seconds: 30, order: 'sequence' }, onshow);
		expect(onshow).toHaveBeenLastCalledWith('a', 'b');
		vi.advanceTimersByTime(29_999);
		expect(onshow).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(1);
		expect(onshow).toHaveBeenLastCalledWith('b', 'c');
		vi.advanceTimersByTime(30_000);
		expect(onshow).toHaveBeenLastCalledWith('c', 'a');
		vi.advanceTimersByTime(30_000);
		expect(onshow).toHaveBeenLastCalledWith('a', 'b');
		slideshow.stop();
	});

	it('loads ahead the photo a new shuffled round actually opens with', () => {
		const shown: [string, string | undefined][] = [];
		startSlideshow(
			['a', 'b', 'c'],
			{ seconds: 10, order: 'shuffle', random: draws(0.3, 0.8, 0.1, 0.6) },
			(current, next) => shown.push([current, next])
		);
		vi.advanceTimersByTime(10_000 * 7);
		for (let index = 1; index < shown.length; index += 1) {
			expect(shown[index][0]).toBe(shown[index - 1][1]);
			expect(shown[index][0]).not.toBe(shown[index - 1][0]);
		}
	});

	it('never steps with a single photo', () => {
		const onshow = vi.fn();
		startSlideshow(['a'], { seconds: 5, order: 'shuffle' }, onshow);
		expect(onshow).toHaveBeenCalledWith('a', undefined);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('shows nothing without photos', () => {
		const onshow = vi.fn();
		startSlideshow([], { seconds: 5, order: 'shuffle' }, onshow);
		expect(onshow).not.toHaveBeenCalled();
	});

	it('holds while paused and gives the photo a full interval on resume', () => {
		const onshow = vi.fn();
		const slideshow = startSlideshow(['a', 'b'], { seconds: 10, order: 'sequence' }, onshow);
		vi.advanceTimersByTime(8_000);
		slideshow.pause();
		vi.advanceTimersByTime(60_000);
		expect(onshow).toHaveBeenCalledTimes(1);
		slideshow.resume();
		vi.advanceTimersByTime(9_999);
		expect(onshow).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(1);
		expect(onshow).toHaveBeenLastCalledWith('b', 'a');
	});

	it('skips at once and restarts the interval', () => {
		const onshow = vi.fn();
		const slideshow = startSlideshow(['a', 'b', 'c'], { seconds: 10, order: 'sequence' }, onshow);
		vi.advanceTimersByTime(6_000);
		slideshow.skip();
		expect(onshow).toHaveBeenLastCalledWith('b', 'c');
		vi.advanceTimersByTime(9_999);
		expect(onshow).toHaveBeenCalledTimes(2);
		vi.advanceTimersByTime(1);
		expect(onshow).toHaveBeenLastCalledWith('c', 'a');
	});

	it('stops for good', () => {
		const onshow = vi.fn();
		const slideshow = startSlideshow(['a', 'b'], { seconds: 10, order: 'sequence' }, onshow);
		slideshow.stop();
		slideshow.resume();
		slideshow.skip();
		vi.advanceTimersByTime(60_000);
		expect(onshow).toHaveBeenCalledTimes(1);
	});
});
