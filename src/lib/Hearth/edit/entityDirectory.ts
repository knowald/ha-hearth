import type { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { fetchRegistry, type RegistrySnapshot } from '$lib/core/ha/registry';

/*
 * What the entity picker knows beyond the entity states: where each entity
 * lives (area, device) from the registries, and which entities this browser
 * picked lately.
 */

export interface EntityPlace {
	area?: string;
	device?: string;
}

export interface PickerEntry {
	entityId: string;
	name: string;
	state: string;
	area?: string;
	device?: string;
	recent: boolean;
}

let places: Promise<Map<string, EntityPlace>> | undefined;

/**
 * Area and device names per entity. Fetched the first time a picker opens and
 * kept for the page's life; a failed fetch is forgotten so the next picker
 * tries again.
 */
export function loadEntityPlaces(): Promise<Map<string, EntityPlace>> {
	places ??= fetchRegistry()
		.then(placesFrom)
		.catch((error) => {
			places = undefined;
			throw error;
		});
	return places;
}

/** Drops the cached registry, so tests start from a cold picker. */
export function forgetEntityPlaces() {
	places = undefined;
}

export function placesFrom(snapshot: RegistrySnapshot): Map<string, EntityPlace> {
	const areas = new Map(snapshot.areas.map((area) => [area.area_id, area.name]));
	const devices = new Map(snapshot.devices.map((device) => [device.id, device]));
	const result = new Map<string, EntityPlace>();
	for (const entity of snapshot.entities) {
		const device = entity.device_id ? devices.get(entity.device_id) : undefined;
		// an entity without its own area sits where its device does
		const areaId = entity.area_id ?? device?.area_id;
		result.set(entity.entity_id, {
			area: (areaId && areas.get(areaId)) || undefined,
			device: device?.name_by_user || device?.name || undefined
		});
	}
	return result;
}

/** The state as a person reads it: the value and its unit. */
export function stateText(entity: HassEntity | undefined): string {
	if (!entity) return '';
	const unit = entity.attributes?.unit_of_measurement;
	return unit ? `${entity.state} ${unit}` : entity.state;
}

export function entityEntries(
	states: HassEntities,
	{
		domains = [],
		deviceClass,
		places,
		recent = []
	}: {
		domains?: string[];
		deviceClass?: string;
		places?: Map<string, EntityPlace>;
		recent?: string[];
	}
): PickerEntry[] {
	return Object.entries(states)
		.filter(([entityId]) => domains.length === 0 || domains.includes(entityId.split('.')[0]))
		.filter(([, entity]) => !deviceClass || entity.attributes?.device_class === deviceClass)
		.map(([entityId, entity]) => ({
			entityId,
			name: String(entity.attributes?.friendly_name ?? entityId),
			state: stateText(entity),
			...places?.get(entityId),
			recent: recent.includes(entityId)
		}));
}

/** Every word of the query must appear in the name, id, area or device. */
export function matchesQuery(entry: PickerEntry, query: string): boolean {
	const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (!words.length) return true;
	const haystack = [entry.name, entry.entityId, entry.area ?? '', entry.device ?? '']
		.join('\n')
		.toLowerCase();
	return words.every((word) => haystack.includes(word));
}

/**
 * Sorted by name, except that with an empty query the recently picked come
 * first, newest first.
 */
export function orderEntries(
	entries: PickerEntry[],
	query: string,
	recent: string[]
): PickerEntry[] {
	const byName = (a: PickerEntry, b: PickerEntry) => a.name.localeCompare(b.name);
	if (query.trim()) return [...entries].sort(byName);
	const rank = (entry: PickerEntry) => recent.indexOf(entry.entityId);
	return [
		...entries.filter((entry) => entry.recent).sort((a, b) => rank(a) - rank(b)),
		...entries.filter((entry) => !entry.recent).sort(byName)
	];
}

/** The areas holding the most entries, busiest first. */
export function topAreas(entries: PickerEntry[], limit = 6): string[] {
	const counts = new Map<string, number>();
	for (const entry of entries) {
		if (entry.area) counts.set(entry.area, (counts.get(entry.area) ?? 0) + 1);
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, limit)
		.map(([area]) => area);
}

const RECENT_KEY = 'hearthRecentEntities';
const RECENT_LIMIT = 8;

/** Entities this browser picked lately, newest first. */
export function recentEntities(): string[] {
	try {
		const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
		return Array.isArray(stored)
			? stored.filter((entry): entry is string => typeof entry === 'string')
			: [];
	} catch {
		// storage blocked by the browser, or a value this code did not write
		return [];
	}
}

export function rememberEntities(entityIds: string[]) {
	// the last of a multi-pick is the newest
	const next = [...new Set([...[...entityIds].reverse(), ...recentEntities()])].slice(
		0,
		RECENT_LIMIT
	);
	try {
		localStorage.setItem(RECENT_KEY, JSON.stringify(next));
	} catch {
		// storage blocked: the picker simply has no recents
	}
}
