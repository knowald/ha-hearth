import { readable } from 'svelte/store';

/** Ticks once a second while subscribed. */
export const timer = readable(new Date(), function start(set) {
	const interval = setInterval(() => {
		set(new Date());
	}, 1000);
	set(new Date());
	return function stop() {
		clearInterval(interval);
	};
});

/**
 * The current time, set once per new minute. It rides on `timer`, so every
 * subscriber shares the one interval instead of starting a timer of its own.
 */
export const minuteTimer = readable(new Date(), function start(set) {
	let minute = -1;
	return timer.subscribe((now) => {
		const current = Math.floor(now.getTime() / 60_000);
		if (current === minute) return;
		minute = current;
		set(now);
	});
});
