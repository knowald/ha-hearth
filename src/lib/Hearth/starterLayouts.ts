import { get } from 'svelte/store';
import type { HassEntities } from 'home-assistant-js-websocket';
import { lang } from '$lib/core/i18n';
import type { RegistrySnapshot } from '$lib/core/ha/registry';
import {
	isStack,
	type EntityRef,
	type HearthConfig,
	type HearthRoom,
	type OverviewCard,
	type OverviewItem,
	type RailWidget
} from './config';
import { applyImport, roomEntityIds } from './importPlan';
import type { HearthProposal, ProposalCategory, ProposedPage } from './proposal';

/*
 * Ready-made dashboards for one kind of screen, built from the same area
 * proposal the import uses, so every page holds the user's own entities.
 */

export type StarterId = 'kitchen' | 'phone' | 'bedside';

export interface StarterLayout {
	id: StarterId;
	name: string;
	sub: string;
	icon: string;
}

export const STARTER_LAYOUTS: StarterLayout[] = [
	{
		id: 'kitchen',
		name: 'hearth_starter_kitchen',
		sub: 'hearth_starter_kitchen_sub',
		icon: 'countertops'
	},
	{
		id: 'phone',
		name: 'hearth_starter_phone',
		sub: 'hearth_starter_phone_sub',
		icon: 'smartphone'
	},
	{ id: 'bedside', name: 'hearth_starter_bedside', sub: 'hearth_starter_bedside_sub', icon: 'bed' }
];

export interface StarterPlan {
	pages: ProposedPage[];
	glanceables: RailWidget[];
}

const MAX_SCENES = 6;

/** Entities a dashboard may show: live, and not disabled, hidden or a config entity. */
function shownEntityIds(snapshot: RegistrySnapshot, currentStates: HassEntities): string[] {
	const excluded = new Set(
		snapshot.entities
			.filter((entity) => entity.disabled_by || entity.hidden_by || entity.entity_category)
			.map((entity) => entity.entity_id)
	);
	return Object.entries(currentStates ?? {})
		.filter(([entityId, state]) => !excluded.has(entityId) && !state.attributes?.restored)
		.map(([entityId]) => entityId)
		.sort();
}

function inDomains(entityIds: string[], domains: string[]) {
	return entityIds.filter((entityId) => domains.includes(entityId.split('.')[0]));
}

function scenesCard(id: string, entityIds: string[], style: 'bar' | 'chips'): OverviewCard[] {
	const scenes = inDomains(entityIds, ['scene']).slice(0, MAX_SCENES);
	return scenes.length
		? [{ id, type: 'scenes', style, scenes: scenes.map((entity) => ({ entity })) }]
		: [];
}

function flatCards(room: HearthRoom): OverviewCard[] {
	return room.cards.flat().flatMap((item) => (isStack(item) ? item.cards : [item]));
}

/** The area page that best fits a keyword, by its icon first and then its name. */
function areaPage(proposal: HearthProposal, icon: string, keyword: RegExp) {
	return (
		proposal.pages.find((page) => page.room.icon === icon) ??
		proposal.pages.find((page) => keyword.test(page.room.name))
	);
}

function countsOf(room: HearthRoom): Record<ProposalCategory, number> {
	const counts = { lights: 0, covers: 0, climate: 0, media: 0, cameras: 0, devices: 0 };
	for (const entity of roomEntityIds(room)) {
		const domain = entity.split('.')[0];
		if (domain === 'light') counts.lights += 1;
		else if (domain === 'cover') counts.covers += 1;
		else if (domain === 'climate') counts.climate += 1;
		else if (domain === 'media_player') counts.media += 1;
		else if (domain === 'camera') counts.cameras += 1;
		else counts.devices += 1;
	}
	return counts;
}

/**
 * Card ids start with the page id, as the import's do: a card borrowed from
 * an area page would otherwise share its id with that page's own copy.
 */
function ownedBy(roomId: string, item: OverviewItem): OverviewItem {
	const id = item.id.startsWith(`${roomId}-`) ? item.id : `${roomId}-${item.id}`;
	if (!isStack(item)) return { ...item, id };
	return { ...item, id, cards: item.cards.map((card) => ownedBy(roomId, card) as OverviewCard) };
}

function starterPage(room: HearthRoom): ProposedPage | undefined {
	const cards = room.cards
		.filter((column) => column.length)
		.map((column) => column.map((item) => ownedBy(room.id, item)));
	if (!cards.length) return undefined;
	const page = { ...room, cards };
	return { room: page, areaId: '', counts: countsOf(page) };
}

/**
 * A kitchen wall tablet: an overview page with the scene bar and the kitchen's
 * own controls in front of a page per area, and the day's glanceables in the
 * rail.
 */
function kitchen(proposal: HearthProposal, shown: string[]): StarterPlan {
	const text = get(lang);
	const area = areaPage(proposal, 'countertops', /kitchen/i);
	const areaCards = area ? area.room.cards : [];
	const grids = areaCards.flat().filter((item) => !isStack(item) && item.type === 'entities');
	const features = areaCards.flat().filter((item) => isStack(item) || item.type !== 'entities');
	// a kitchen without its own speaker still gets the first one in the house
	const media = features.some((item) => !isStack(item) && item.type === 'media')
		? []
		: inDomains(shown, ['media_player'])
				.slice(0, 1)
				.map((entity): OverviewCard => ({ id: 'kitchen-tablet-media', type: 'media', entity }));
	const overview = starterPage({
		id: 'kitchen-tablet',
		name: area?.room.name ?? text('hearth_starter_kitchen_page'),
		icon: 'countertops',
		temp_entity: area?.room.temp_entity,
		humidity_entity: area?.room.humidity_entity,
		cards: [
			[...scenesCard('kitchen-tablet-scenes', shown, 'bar'), ...grids],
			[...features, ...media]
		]
	});
	const others = proposal.pages.filter((page) => page !== area);
	return {
		pages: overview ? [overview, ...others] : others,
		glanceables: proposal.glanceables
	};
}

/**
 * A phone in the hand: one page of scenes and a collapsed row per area that
 * opens its controls, and nothing added to the rail, which a phone folds
 * under the page.
 */
function phone(proposal: HearthProposal, shown: string[]): StarterPlan {
	const rows: OverviewItem[] = proposal.pages.flatMap((page) => {
		const entities: EntityRef[] = flatCards(page.room).flatMap((card) => {
			if (card.type === 'entities') return card.entities;
			if (card.type === 'climate' && card.entity) return [{ entity: card.entity }];
			return [];
		});
		return entities.length
			? [
					{
						id: `remote-${page.room.id}`,
						type: 'entities' as const,
						title: page.room.name,
						icon: page.room.icon,
						collapsed: true,
						entities
					}
				]
			: [];
	});
	const remote = starterPage({
		id: 'remote',
		name: get(lang)('hearth_starter_phone_page'),
		icon: 'smartphone',
		columns: 1,
		cards: [[...scenesCard('remote-scenes', shown, 'chips'), ...rows]]
	});
	return { pages: remote ? [remote] : [], glanceables: [] };
}

/**
 * A small screen by the bed: the bedroom's lights, covers and climate, the
 * house's locks and alarm in one place, and the weather and calendar.
 */
function bedside(proposal: HearthProposal, shown: string[]): StarterPlan {
	const text = get(lang);
	const area = areaPage(proposal, 'bed', /bed/i);
	const security = inDomains(shown, ['lock', 'alarm_control_panel']);
	const page = starterPage({
		id: 'bedside',
		name: text('hearth_starter_bedside_page'),
		icon: 'bed',
		temp_entity: area?.room.temp_entity,
		humidity_entity: area?.room.humidity_entity,
		columns: 1,
		cards: [
			[
				...(area ? flatCards(area.room).filter((card) => card.type !== 'camera') : []),
				...(security.length
					? [
							{
								id: 'bedside-security',
								type: 'entities' as const,
								title: text('hearth_starter_security'),
								entities: security.map((entity) => ({ entity }))
							}
						]
					: []),
				...scenesCard('bedside-scenes', shown, 'chips')
			]
		]
	});
	// the label heads the calendar, so it goes where the calendar goes
	const calendar = proposal.glanceables.some((widget) => widget.type === 'calendar');
	return {
		pages: page ? [page] : [],
		glanceables: proposal.glanceables.filter(
			(widget) =>
				widget.type === 'weather' ||
				widget.type === 'calendar' ||
				(widget.type === 'label' && calendar)
		)
	};
}

const BUILDERS: Record<StarterId, (proposal: HearthProposal, shown: string[]) => StarterPlan> = {
	kitchen,
	phone,
	bedside
};

export function buildStarter(
	id: StarterId,
	proposal: HearthProposal,
	snapshot: RegistrySnapshot,
	currentStates: HassEntities
): StarterPlan {
	return BUILDERS[id](proposal, shownEntityIds(snapshot, currentStates));
}

/**
 * Adds a starter's pages and rail suggestions. A dashboard that is still the
 * single empty page it started as loses that page, so it opens on the
 * starter's first one; a page whose name is taken is left alone.
 */
export function applyStarter(config: HearthConfig, plan: StarterPlan) {
	const untouched =
		config.rooms.length === 1 && (config.rooms[0].cards ?? []).every((column) => !column.length);
	if (untouched && plan.pages.length) config.rooms = [];
	applyImport(config, { pages: plan.pages, glanceables: plan.glanceables, mode: 'add' });
}
