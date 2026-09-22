import { get } from 'svelte/store';
import type { HassEntities } from 'home-assistant-js-websocket';
import { lang } from '$lib/core/i18n';
import type { RegistryArea, RegistryEntity, RegistrySnapshot } from '$lib/core/ha/registry';
import {
	slugify,
	uniqueId,
	type EntityRef,
	type HearthRoom,
	type OverviewItem,
	type RailWidget
} from './config';

/** What a proposed page holds, for the wizard's per-page summary. */
export type ProposalCategory = 'lights' | 'covers' | 'climate' | 'media' | 'cameras' | 'devices';

export interface ProposedPage {
	room: HearthRoom;
	areaId: string;
	floorName?: string;
	counts: Record<ProposalCategory, number>;
}

export interface HearthProposal {
	pages: ProposedPage[];
	glanceables: RailWidget[];
}

/**
 * Area icons come from Home Assistant as MDI names, Hearth draws Material
 * Symbols. Only the icons the area picker offers by default need a mapping;
 * anything else falls back to the name keywords below.
 */
const MDI_TO_SYMBOL: Record<string, string> = {
	sofa: 'weekend',
	'sofa-outline': 'weekend',
	'seat-outline': 'weekend',
	television: 'tv',
	bed: 'bed',
	'bed-empty': 'bed',
	'bed-king': 'bed',
	'bed-queen': 'bed',
	'chef-hat': 'countertops',
	countertop: 'countertops',
	fridge: 'kitchen',
	'silverware-fork-knife': 'restaurant',
	'table-furniture': 'restaurant',
	toilet: 'bathtub',
	shower: 'shower',
	bathtub: 'bathtub',
	'paper-roll-outline': 'bathtub',
	door: 'meeting_room',
	'door-open': 'meeting_room',
	'coat-rack': 'meeting_room',
	stairs: 'stairs',
	garage: 'garage',
	'garage-variant': 'garage',
	car: 'directions_car',
	laptop: 'desk',
	desk: 'desk',
	'desktop-tower-monitor': 'desk',
	briefcase: 'work',
	bookshelf: 'menu_book',
	'washing-machine': 'local_laundry_service',
	'tumble-dryer': 'local_laundry_service',
	'washing-machine-alert': 'local_laundry_service',
	flower: 'yard',
	'flower-outline': 'yard',
	tree: 'yard',
	grass: 'yard',
	greenhouse: 'yard',
	pool: 'pool',
	'teddy-bear': 'child_care',
	'baby-carriage': 'child_care',
	'human-male-child': 'child_care',
	tools: 'handyman',
	'home-floor-b': 'foundation',
	'stairs-down': 'foundation',
	'home-roof': 'roofing',
	'office-building': 'apartment',
	dumbbell: 'fitness_center',
	paw: 'pets'
};

const AREA_ICON_KEYWORDS: [string[], string][] = [
	[['bed'], 'bed'],
	[['living', 'lounge'], 'weekend'],
	[['kitchen'], 'countertops'],
	[['office', 'study'], 'desk'],
	[['bath', 'shower', 'toilet'], 'bathtub'],
	[['hall', 'entry', 'corridor'], 'meeting_room'],
	[['garage'], 'garage'],
	[['garden', 'yard', 'balcony', 'terrace'], 'yard'],
	[['kid', 'child', 'nursery'], 'child_care'],
	[['dining'], 'restaurant'],
	[['laundry', 'utility'], 'local_laundry_service'],
	[['attic', 'loft'], 'roofing'],
	[['basement', 'cellar'], 'foundation'],
	[['gym'], 'fitness_center'],
	[['stair'], 'stairs']
];

/** The area's own icon when Hearth can draw it, else a guess from its name. */
function areaIcon(area: RegistryArea): string {
	const mdi = area.icon?.replace(/^mdi:/, '');
	if (mdi && MDI_TO_SYMBOL[mdi]) return MDI_TO_SYMBOL[mdi];
	const lowered = area.name.toLowerCase();
	for (const [keywords, icon] of AREA_ICON_KEYWORDS) {
		if (keywords.some((keyword) => lowered.includes(keyword))) return icon;
	}
	return 'meeting_room';
}

/** Drops a redundant room name around an entity name, e.g. "Kitchen Ceiling" -> "Ceiling". */
function stripRoomName(name: string, roomNames: string[]): string {
	const trim = (text: string) => text.replace(/^[\s:,-]+|[\s:,-]+$/g, '').trim();
	// only on a word of its own: "Hall" must not turn "Hallway Light" into "way Light"
	const separated = /^[\s:,-]/;
	for (const roomName of roomNames) {
		if (!roomName) continue;
		const lowered = name.toLowerCase();
		const room = roomName.toLowerCase();
		if (lowered.startsWith(room)) {
			const rest = name.slice(roomName.length);
			const stripped = trim(rest);
			if (stripped && separated.test(rest)) return stripped;
		}
		if (lowered.endsWith(room)) {
			const rest = name.slice(0, name.length - roomName.length);
			const stripped = trim(rest);
			if (stripped && separated.test(rest.slice(-1))) return stripped;
		}
	}
	return name;
}

// devices that share the general-purpose grid, in the order they appear in it
const DEVICE_DOMAIN_ORDER = ['fan', 'switch', 'vacuum', 'lock', 'humidifier', 'water_heater'];

const MAX_PER_CARD: Record<ProposalCategory, number> = {
	lights: 12,
	covers: 8,
	climate: 1,
	media: 1,
	cameras: 2,
	devices: 10
};

function byName(a: EntityRef, b: EntityRef) {
	return (a.name ?? a.entity).localeCompare(b.name ?? b.entity);
}

function suggestGlanceables(currentStates: HassEntities): RailWidget[] {
	const entries = Object.entries(currentStates ?? {});
	const weather = entries.find(([entityId]) => entityId.startsWith('weather.'))?.[0];
	const energy = entries.find(
		([entityId, entity]) =>
			entityId.startsWith('sensor.') &&
			(entity.attributes?.device_class === 'energy' ||
				String(entity.attributes?.unit_of_measurement ?? '').toLowerCase() === 'kwh')
	)?.[0];
	const calendars = entries
		.filter(([entityId]) => entityId.startsWith('calendar.'))
		.slice(0, 3)
		.map(([entityId]) => entityId);
	const appliance = entries.find(([entityId, entity]) => {
		const haystack = `${entityId} ${entity.attributes?.friendly_name ?? ''}`.toLowerCase();
		return /(dishwasher|washing_machine|washer|laundry)/.test(haystack);
	});

	const today: RailWidget[] = [];
	if (energy) today.push({ id: 'today-energy', type: 'energy', entity: energy });
	if (appliance) {
		today.push({
			id: 'today-appliance',
			type: 'progress',
			name: String(appliance[1].attributes?.friendly_name ?? get(lang)('hearth_appliance')),
			status_entity: appliance[0]
		});
	}
	if (calendars.length) {
		today.push({ id: 'today-calendar', type: 'calendar', entities: calendars });
	}

	return [
		...(weather ? [{ id: 'today-weather', type: 'weather' as const, entity: weather }] : []),
		...(today.length
			? [{ id: 'today-label', type: 'label' as const, text: get(lang)('hearth_today') }, ...today]
			: [])
	];
}

/** Entities of an area, bucketed by the card each one belongs in. */
interface AreaBuckets {
	lights: EntityRef[];
	covers: EntityRef[];
	climate: string[];
	media: string[];
	cameras: string[];
	devices: Map<string, EntityRef[]>;
	temperature?: string;
	humidity?: string;
}

/**
 * Turns the Home Assistant registries into proposed pages, one per area, and
 * a set of rail suggestions. Each entity lands in its own area or falls back
 * to its device's area. Disabled, hidden, config and diagnostic registry
 * entries are skipped, as are entities without a live state object.
 */
export function buildProposal(
	snapshot: RegistrySnapshot,
	currentStates: HassEntities
): HearthProposal {
	const deviceAreas = new Map(snapshot.devices.map((device) => [device.id, device.area_id]));

	const areaEntities = new Map<string, RegistryEntity[]>();
	for (const entity of snapshot.entities) {
		if (entity.disabled_by || entity.hidden_by || entity.entity_category) continue;
		const state = currentStates?.[entity.entity_id];
		// an entity left behind by a removed integration keeps a state object
		if (!state || state.attributes?.restored) continue;
		const areaId =
			entity.area_id ?? (entity.device_id ? deviceAreas.get(entity.device_id) : null) ?? null;
		if (!areaId) continue;
		const list = areaEntities.get(areaId);
		if (list) list.push(entity);
		else areaEntities.set(areaId, [entity]);
	}

	const friendlyName = (entity: RegistryEntity): string =>
		currentStates[entity.entity_id]?.attributes?.friendly_name ??
		entity.name ??
		entity.original_name ??
		entity.entity_id;

	const floorNames = new Map(snapshot.floors.map((floor) => [floor.floor_id, floor.name]));
	const floorRank = new Map(
		[...snapshot.floors]
			.sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name))
			.map((floor, index) => [floor.floor_id, index])
	);
	// areas without a floor sort after every floor, then alphabetically
	const sortedAreas = [...snapshot.areas].sort(
		(a, b) =>
			(floorRank.get(a.floor_id ?? '') ?? Number.MAX_SAFE_INTEGER) -
				(floorRank.get(b.floor_id ?? '') ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)
	);

	const pages: ProposedPage[] = [];
	const roomIds: string[] = [];

	for (const area of sortedAreas) {
		const entities = areaEntities.get(area.area_id);
		if (!entities) continue;

		const buckets: AreaBuckets = {
			lights: [],
			covers: [],
			climate: [],
			media: [],
			cameras: [],
			devices: new Map()
		};
		const roomNames = [area.name, ...(area.aliases ?? [])];

		for (const entity of entities) {
			const domain = entity.entity_id.split('.')[0];
			const ref: EntityRef = {
				entity: entity.entity_id,
				name: stripRoomName(friendlyName(entity), roomNames)
			};

			if (domain === 'light') buckets.lights.push(ref);
			else if (domain === 'cover') buckets.covers.push(ref);
			else if (domain === 'climate') buckets.climate.push(entity.entity_id);
			else if (domain === 'media_player') buckets.media.push(entity.entity_id);
			else if (domain === 'camera') buckets.cameras.push(entity.entity_id);
			else if (DEVICE_DOMAIN_ORDER.includes(domain)) {
				const list = buckets.devices.get(domain) ?? [];
				list.push(ref);
				buckets.devices.set(domain, list);
			} else if (domain === 'sensor') {
				const deviceClass = currentStates[entity.entity_id]?.attributes?.device_class;
				if (deviceClass === 'temperature') buckets.temperature ??= entity.entity_id;
				if (deviceClass === 'humidity') buckets.humidity ??= entity.entity_id;
			}
		}

		const lights = buckets.lights.sort(byName).slice(0, MAX_PER_CARD.lights);
		const covers = buckets.covers.sort(byName).slice(0, MAX_PER_CARD.covers);
		const devices = DEVICE_DOMAIN_ORDER.flatMap((domain) =>
			(buckets.devices.get(domain) ?? []).sort(byName)
		).slice(0, MAX_PER_CARD.devices);
		const climate = buckets.climate.sort().slice(0, MAX_PER_CARD.climate);
		const media = buckets.media.sort().slice(0, MAX_PER_CARD.media);
		const cameras = buckets.cameras.sort().slice(0, MAX_PER_CARD.cameras);

		if (
			!lights.length &&
			!covers.length &&
			!devices.length &&
			!climate.length &&
			!media.length &&
			!cameras.length
		) {
			continue;
		}

		const roomId = uniqueId(slugify(area.name), roomIds);
		roomIds.push(roomId);

		// the grids and the single-entity cards make two readable columns; with
		// only one kind present the page stays a single column
		const grids: OverviewItem[] = [
			...(lights.length
				? [
						{
							id: `${roomId}-lighting`,
							type: 'entities' as const,
							title: get(lang)('hearth_lighting'),
							show_count: true,
							entities: lights
						}
					]
				: []),
			...(covers.length
				? [
						{
							id: `${roomId}-covers`,
							type: 'entities' as const,
							title: get(lang)('hearth_covers'),
							entities: covers
						}
					]
				: []),
			...(devices.length
				? [
						{
							id: `${roomId}-devices`,
							type: 'entities' as const,
							title: get(lang)('hearth_devices'),
							entities: devices
						}
					]
				: [])
		];
		const features: OverviewItem[] = [
			...climate.map((entity, index) => ({
				id: `${roomId}-climate${index ? `-${index + 1}` : ''}`,
				type: 'climate' as const,
				entity
			})),
			...media.map((entity, index) => ({
				id: `${roomId}-media${index ? `-${index + 1}` : ''}`,
				type: 'media' as const,
				entity
			})),
			...cameras.map((entity, index) => ({
				id: `${roomId}-camera${index ? `-${index + 1}` : ''}`,
				type: 'camera' as const,
				entity
			}))
		];

		pages.push({
			areaId: area.area_id,
			floorName: area.floor_id ? floorNames.get(area.floor_id) : undefined,
			counts: {
				lights: lights.length,
				covers: covers.length,
				climate: climate.length,
				media: media.length,
				cameras: cameras.length,
				devices: devices.length
			},
			room: {
				id: roomId,
				name: area.name,
				icon: areaIcon(area),
				temp_entity: area.temperature_entity_id ?? buckets.temperature,
				humidity_entity: area.humidity_entity_id ?? buckets.humidity,
				cards: grids.length && features.length ? [grids, features] : [[...grids, ...features]]
			}
		});
	}

	return { pages, glanceables: suggestGlanceables(currentStates) };
}
