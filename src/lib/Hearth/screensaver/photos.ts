import type { ScreensaverPhotoOrder } from '../config';

/**
 * One round of the slideshow. A shuffle is a fresh Fisher-Yates permutation,
 * and never opens with `previous`, the photo that closed the last round, so
 * no photo shows twice in a row across rounds.
 */
export function photoRound(
	photos: readonly string[],
	order: ScreensaverPhotoOrder,
	previous?: string,
	random: () => number = Math.random
): string[] {
	const round = [...photos];
	if (order === 'sequence') return round;
	for (let index = round.length - 1; index > 0; index -= 1) {
		const swap = Math.floor(random() * (index + 1));
		[round[index], round[swap]] = [round[swap], round[index]];
	}
	if (round.length > 1 && round[0] === previous) [round[0], round[1]] = [round[1], round[0]];
	return round;
}

export interface Slideshow {
	/** Moves on at once, as when the current photo failed to load. */
	skip(): void;
	pause(): void;
	/** Shows the current photo for a full interval again. */
	resume(): void;
	stop(): void;
}

/**
 * Steps through the photos every `seconds`, telling `onshow` the photo to show
 * and the one after it, which the caller loads ahead. A single photo never
 * schedules a step.
 */
export function startSlideshow(
	photos: readonly string[],
	options: { seconds: number; order: ScreensaverPhotoOrder; random?: () => number },
	onshow: (current: string, next: string | undefined) => void
): Slideshow {
	const { order, random } = options;
	let round = photoRound(photos, order, undefined, random);
	let position = 0;
	// drawn when the last photo of a round shows, so the photo loaded ahead is the one shown next
	let nextRound: string[] | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;

	function upcoming(): string | undefined {
		if (photos.length < 2) return undefined;
		if (position + 1 < round.length) return round[position + 1];
		nextRound ??= photoRound(photos, order, round[position], random);
		return nextRound[0];
	}

	function show() {
		onshow(round[position], upcoming());
	}

	function step() {
		if (position + 1 < round.length) {
			position += 1;
		} else {
			round = nextRound ?? photoRound(photos, order, round[position], random);
			nextRound = undefined;
			position = 0;
		}
		show();
		schedule();
	}

	function schedule() {
		clearTimeout(timer);
		timer = undefined;
		if (stopped || photos.length < 2) return;
		timer = setTimeout(step, options.seconds * 1000);
	}

	if (photos.length) {
		show();
		schedule();
	}

	return {
		skip() {
			if (!stopped && photos.length > 1) step();
		},
		pause() {
			clearTimeout(timer);
			timer = undefined;
		},
		resume() {
			if (!timer) schedule();
		},
		stop() {
			stopped = true;
			clearTimeout(timer);
		}
	};
}
