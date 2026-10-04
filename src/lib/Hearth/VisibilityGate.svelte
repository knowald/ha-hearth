<script lang="ts">
	import type { Snippet } from 'svelte';
	import { minuteTimer } from '$lib/core/app/clock';
	import { deviceName } from '$lib/core/app/device';
	import { displayTimeZone } from './store';
	import { states } from '$lib/core/ha/entities';
	import type { VisibilityCondition } from './config';
	import { evaluateVisibility, mediaQueriesIn, usesTime } from './visibility';

	let {
		conditions,
		children
	}: { conditions?: VisibilityCondition[]; children: Snippet<[boolean]> } = $props();

	let mediaMatches = $state<Record<string, boolean>>({});

	// (re)subscribes to just the media queries this item's conditions use,
	// tearing down the previous set's listeners whenever conditions change
	$effect(() => {
		const queries = mediaQueriesIn(conditions ?? []);

		if (queries.length === 0) {
			mediaMatches = {};
			return;
		}

		const entries = queries.flatMap((query) => {
			let mql: MediaQueryList;
			try {
				mql = window.matchMedia(query);
			} catch {
				// user-entered queries can be malformed css; treat as non-matching
				return [];
			}
			const listener = () => {
				mediaMatches = { ...mediaMatches, [query]: mql.matches };
			};
			mql.addEventListener('change', listener);
			return [{ query, mql, listener }];
		});

		mediaMatches = Object.fromEntries(entries.map(({ query, mql }) => [query, mql.matches]));

		return () => {
			for (const { mql, listener } of entries) mql.removeEventListener('change', listener);
		};
	});

	// only items with a time condition follow the shared minute clock
	let now = $state<Date | undefined>();
	$effect(() => {
		if (!usesTime(conditions)) {
			now = undefined;
			return;
		}
		return minuteTimer.subscribe((value) => (now = value));
	});

	let visible = $derived(
		evaluateVisibility(conditions, $states, mediaMatches, {
			device: $deviceName,
			now,
			timeZone: $displayTimeZone
		})
	);
</script>

{@render children(visible)}
