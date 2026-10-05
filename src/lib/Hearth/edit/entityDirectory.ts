import type { Connection, HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { get } from 'svelte/store';
import { connection } from '$lib/core/ha/connection';
import { fetchDisplayRegistry, type DisplayRegistry } from '$lib/core/ha/registry';

/*
 * What the entity picker knows beyond the entity states: where each entity
 * lives (area, device) from the registries, and which entities this browser
 * picked lately.
 */

export interface EntityPlace {
	areaId?: string;
	area?: string;
	device?: string;
}

/** The part of a picker row that changes only with its entity or the registry. */
interface BaseEntry extends EntityPlace {
	entityId: string;
	name: string;
	/** false when the name is only the id again, which the row then shows once */
	named: boolean;
	// lowercased name, id, area and device, matched against the query
	haystack: string;
}

export interface PickerEntry extends BaseEntry {
	recent: boolean;
	/** Fits the requested device class; the rest sort after. */
	fits: boolean;
}

export const REGISTRY_TIMEOUT_MS = 10_000;

let cached: { conn: Connection; places: Promise<Map<string, EntityPlace>> } | undefined;

/**
 * Area and device names per entity. Fetched the first time a picker opens and
 * kept for the connection's life; a new connection fetches again. A failed or
 * stalled fetch is forgotten so the next picker tries again.
 */
export function loadEntityPlaces(): Promise<Map<string, EntityPlace>> {
	const conn = get(connection);
	if (!conn) return Promise.reject(new Error('Not connected to Home Assistant'));
	if (cached?.conn === conn) return cached.places;
	const entry = {
		conn,
		places: withTimeout(fetchDisplayRegistry(conn), REGISTRY_TIMEOUT_MS)
			.then(placesFrom)
			.catch((error) => {
				if (cached === entry) cached = undefined;
				throw error;
			})
	};
	cached = entry;
	return entry.places;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error('Registry request timed out')), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Drops the cached registry, so tests start from a cold picker. */
export function forgetEntityPlaces() {
	cached = undefined;
}

export function placesFrom(registry: DisplayRegistry): Map<string, EntityPlace> {
	const areas = new Map(registry.areas.map((area) => [area.area_id, area.name]));
	const devices = new Map(registry.devices.map((device) => [device.id, device]));
	const result = new Map<string, EntityPlace>();
	for (const entity of registry.entities) {
		const device = entity.device_id ? devices.get(entity.device_id) : undefined;
		// an entity without its own area sits where its device does
		const areaId = entity.area_id ?? device?.area_id ?? undefined;
		const area = areaId ? areas.get(areaId) : undefined;
		result.set(entity.entity_id, {
			areaId: area ? areaId : undefined,
			area,
			device: device?.name_by_user || device?.name || undefined
		});
	}
	return result;
}

// units that mark a sensor without a device_class (a template or MQTT
// sensor, say) as the kind a field asks for
const CLASS_UNITS: Record<string, string[]> = {
	temperature: ['\u00b0C', '\u00b0F', 'K'],
	humidity: ['%']
};

export function fitsDeviceClass(entity: HassEntity | undefined, deviceClass?: string): boolean {
	if (!deviceClass) return true;
	const declared = entity?.attributes?.device_class;
	if (declared) return declared === deviceClass;
	const unit = entity?.attributes?.unit_of_measurement;
	return typeof unit === 'string' && (CLASS_UNITS[deviceClass]?.includes(unit) ?? false);
}

/**
 * Builds rows for one registry snapshot. States change many times a minute,
 * but an unchanged entity keeps its object, so its row is reused rather than
 * its name, place and search text rebuilt.
 */
export function entryBuilder(places?: Map<string, EntityPlace>) {
	const built = new WeakMap<HassEntity, BaseEntry>();
	return (entityId: string, entity: HassEntity): BaseEntry => {
		let entry = built.get(entity);
		if (!entry) {
			const friendly = entity.attributes?.friendly_name;
			const name = friendly ? String(friendly) : entityId;
			const place = places?.get(entityId);
			entry = {
				entityId,
				name,
				named: !!friendly,
				...place,
				haystack: [name, entityId, place?.area ?? '', place?.device ?? ''].join('\n').toLowerCase()
			};
			built.set(entity, entry);
		}
		return entry;
	};
}

export function entityEntries(
	states: HassEntities,
	{
		domains = [],
		deviceClass,
		recent = [],
		build = entryBuilder()
	}: {
		domains?: string[];
		deviceClass?: string;
		recent?: string[];
		build?: (entityId: string, entity: HassEntity) => BaseEntry;
	}
): PickerEntry[] {
	return Object.entries(states)
		.filter(([entityId]) => domains.length === 0 || domains.includes(entityId.split('.')[0]))
		.map(([entityId, entity]) => ({
			...build(entityId, entity),
			recent: recent.includes(entityId),
			fits: fitsDeviceClass(entity, deviceClass)
		}));
}

export function queryWords(query: string): string[] {
	return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** Every word of the query must appear in the name, id, area or device. */
export function matchesQuery(entry: PickerEntry, words: string[]): boolean {
	return words.every((word) => entry.haystack.includes(word));
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/**
 * Entries fitting the device class first; then, with an empty query, the
 * recently picked, newest first; then by name.
 */
export function orderEntries(
	entries: PickerEntry[],
	query: string,
	recent: string[]
): PickerEntry[] {
	const browsing = !query.trim();
	const recency = (entry: PickerEntry) =>
		browsing && entry.recent ? recent.indexOf(entry.entityId) : recent.length;
	return [...entries].sort(
		(a, b) =>
			Number(b.fits) - Number(a.fits) || recency(a) - recency(b) || collator.compare(a.name, b.name)
	);
}

/**
 * The areas holding the most entries, in name order so the chips stay put
 * while the user types.
 */
export function topAreas(entries: PickerEntry[], limit = 6): { id: string; name: string }[] {
	const counts = new Map<string, { id: string; name: string; count: number }>();
	for (const entry of entries) {
		if (!entry.areaId || !entry.area) continue;
		const area = counts.get(entry.areaId) ?? { id: entry.areaId, name: entry.area, count: 0 };
		area.count += 1;
		counts.set(entry.areaId, area);
	}
	return [...counts.values()]
		.sort((a, b) => b.count - a.count || collator.compare(a.name, b.name))
		.slice(0, limit)
		.sort((a, b) => collator.compare(a.name, b.name))
		.map(({ id, name }) => ({ id, name }));
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
