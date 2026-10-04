import { derived, readable, type Readable } from 'svelte/store';
import { deviceName } from '$lib/core/app/device';
import { states } from '$lib/core/ha/entities';
import { mediaQuery } from '$lib/ui/mediaQuery';
import type { HearthRoom, VisibilityCondition } from './config';
import { hearthConfig, hearthEditMode } from './store';
import { clockFor, evaluateVisibility, mediaQueriesIn, type VisibilityContext } from './visibility';

/*
 * Page visibility. A page whose conditions do not hold leaves the nav widget,
 * the phone strip, search and swipe navigation; edit mode keeps every page
 * reachable and dims the hidden ones instead.
 */

/** Ids of the pages whose visibility conditions do not hold. */
export function hiddenPageIds(
	rooms: Pick<HearthRoom, 'id' | 'visibility'>[],
	$states: Parameters<typeof evaluateVisibility>[1],
	mediaMatches: Record<string, boolean>,
	context: VisibilityContext
): string[] {
	return rooms
		.filter((room) => !evaluateVisibility(room.visibility, $states, mediaMatches, context))
		.map((room) => room.id);
}

/**
 * The pages to offer, in order. Nothing is ever hidden while editing, and
 * when every page is hidden the first one stays so there is something to show.
 */
export function shownPages<T extends { id: string }>(
	rooms: T[],
	hidden: readonly string[],
	editing: boolean
): T[] {
	if (editing || !hidden.length) return rooms;
	const shown = rooms.filter((room) => !hidden.includes(room.id));
	return shown.length ? shown : rooms.slice(0, 1);
}

const pageConditions = derived(hearthConfig, ($config) =>
	$config.rooms.flatMap((room): VisibilityCondition[] => room.visibility ?? [])
);

const pageClock = clockFor(pageConditions);

const pageMedia: Readable<Record<string, boolean>> = derived(
	pageConditions,
	($conditions, set: (value: Record<string, boolean>) => void) => {
		const queries = [...new Set(mediaQueriesIn($conditions))];
		if (!queries.length) {
			set({});
			return;
		}
		const matches: Readable<boolean[]> = derived(queries.map(mediaQuery), (values) => values);
		return matches.subscribe((values) =>
			set(Object.fromEntries(queries.map((query, index) => [query, values[index]])))
		);
	}
);

const hiddenList = derived(
	[hearthConfig, states, deviceName, pageClock, pageMedia],
	([$config, $states, $device, $now, $media]) =>
		// before the first states arrive every entity condition would fail; a
		// ?room= link to a page that only shows once they are in must survive that
		$states === undefined
			? []
			: hiddenPageIds($config.rooms, $states, $media, { device: $device, now: $now })
);

/**
 * Ids of the pages hidden on this screen right now. A new list is only set
 * when it changes, not on every state change that leaves it the same.
 */
export const hiddenPages: Readable<string[]> = readable<string[]>([], (set) => {
	let key: string | undefined;
	return hiddenList.subscribe((ids) => {
		const next = ids.join('\n');
		if (next === key) return;
		key = next;
		set(ids);
	});
});

/** The pages navigation offers: the shown ones, or all of them while editing. */
export const navigablePages = derived(
	[hearthConfig, hiddenPages, hearthEditMode],
	([$config, $hidden, $editing]) => shownPages($config.rooms, $hidden, $editing)
);
