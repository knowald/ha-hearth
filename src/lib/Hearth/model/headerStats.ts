import type { HeaderStat } from '../types';
import { isRecord, trimmedOrUndefined } from '../normalizers';

/*
 * The readings at the top right of a page header or header card. `stats`
 * lists them; a header without it shows its temp_entity and humidity_entity,
 * as every header did before the list existed.
 */

/** What a header with readings stores: the list, or the two older fields. */
export interface HeaderReadings {
	stats?: HeaderStat[];
	temp_entity?: string;
	humidity_entity?: string;
}

/** A reading to show; `kind` formats the older fields as they always were. */
export interface ShownStat extends HeaderStat {
	kind?: 'temperature' | 'humidity';
}

export function headerStatList(header: HeaderReadings | undefined): ShownStat[] {
	if (header?.stats) return header.stats;
	return [
		...(header?.temp_entity ? [{ entity: header.temp_entity, kind: 'temperature' as const }] : []),
		...(header?.humidity_entity
			? [{ entity: header.humidity_entity, kind: 'humidity' as const }]
			: [])
	];
}

/** Entries without an entity are dropped; anything but a list is unset. */
export function normalizeHeaderStats(raw: unknown): HeaderStat[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	return raw.flatMap((entry) => {
		if (!isRecord(entry)) return [];
		const entity = trimmedOrUndefined(entry.entity);
		return entity ? [{ entity, name: trimmedOrUndefined(entry.name) }] : [];
	});
}

/**
 * The fields an editor stores for the rows it shows. Rows that only repeat
 * the older fields keep them, so opening and closing an editor leaves the
 * file alone; any other list replaces them.
 */
export function storedHeaderStats(
	rows: { entity: string; name: string }[],
	header: HeaderReadings | undefined
): HeaderReadings {
	const stats = rows
		.map((row) => ({ entity: row.entity.trim(), name: row.name.trim() || undefined }))
		.filter((row) => row.entity);
	const legacy = header?.stats ? undefined : headerStatList(header);
	const unchanged =
		legacy !== undefined &&
		stats.length === legacy.length &&
		stats.every((stat, index) => !stat.name && stat.entity === legacy[index].entity);
	if (unchanged) {
		return {
			stats: undefined,
			temp_entity: header?.temp_entity,
			humidity_entity: header?.humidity_entity
		};
	}
	return { stats, temp_entity: undefined, humidity_entity: undefined };
}
