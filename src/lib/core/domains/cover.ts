import { get } from 'svelte/store';
import type { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { entityControllable, states } from '../ha/entities';
import { fill, lang } from '../i18n';
import {
	clamp,
	controlOverrides,
	controlValueFor,
	markPending,
	service,
	setControlOverride,
	throttled
} from '../ha/commands';

/** Optimistic 0-100 position of a cover, drag overrides included. */
export function blindPositionFor(
	entityId: string,
	$states: HassEntities | undefined,
	$overrides: Record<string, number>
): number {
	const entity = $states?.[entityId];
	const actual = entity?.attributes?.current_position ?? (entity?.state === 'open' ? 100 : 0);
	return clamp($overrides[`blind:${entityId}`] ?? Math.round(actual), 0, 100);
}

export function toggleBlind(entityId: string) {
	if (!entityControllable(get(states)?.[entityId])) return;
	const open = blindPositionFor(entityId, get(states), get(controlOverrides)) > 0;
	setControlOverride(`blind:${entityId}`, open ? 0 : 100);
	markPending(entityId);
	service('cover', open ? 'close_cover' : 'open_cover', { entity_id: entityId });
}

export function setBlindPosition(entityId: string, position: number, commit = true) {
	if (!entityControllable(get(states)?.[entityId])) return;
	const target = clamp(position, 0, 100);
	setControlOverride(`blind:${entityId}`, target);
	if (!commit) return;
	throttled(
		`blind:${entityId}`,
		() => service('cover', 'set_cover_position', { entity_id: entityId, position: target }),
		400
	);
}

export function blindTiltFor(
	entityId: string,
	$states: HassEntities | undefined,
	$overrides: Record<string, number>
): number {
	const actual = Math.round($states?.[entityId]?.attributes?.current_tilt_position ?? 0);
	return clamp(controlValueFor(`tilt:${entityId}`, actual, $overrides), 0, 100);
}

export function setBlindTiltPosition(entityId: string, position: number, commit = true) {
	if (!entityControllable(get(states)?.[entityId])) return;
	const target = clamp(Math.round(position), 0, 100);
	setControlOverride(`tilt:${entityId}`, target);
	if (!commit) return;
	throttled(
		`tilt:${entityId}`,
		() =>
			service('cover', 'set_cover_tilt_position', {
				entity_id: entityId,
				tilt_position: target
			}),
		400
	);
}

/** Header verb for a blinds section: every cover to fully open or closed. */
export function setAllCovers(entityIds: string[], open: boolean) {
	const targets = entityIds.filter((entityId) => entityControllable(get(states)?.[entityId]));
	if (!targets.length) return;
	for (const entityId of targets) {
		setControlOverride(`blind:${entityId}`, open ? 100 : 0);
		markPending(entityId);
	}
	service('cover', open ? 'open_cover' : 'close_cover', { entity_id: targets });
}

const ACCESS_DEVICE_CLASSES = ['door', 'garage', 'garage_door', 'gate'];

/** Doors, garage doors and gates: moving one opens the house to the outside. */
export function coverIsAccessPoint(entity: HassEntity | undefined): boolean {
	return ACCESS_DEVICE_CLASSES.includes(String(entity?.attributes?.device_class ?? ''));
}

export interface CoverConfirmation {
	title: string;
	message: string;
	confirmLabel: string;
	action: () => void;
}

/**
 * Runs `action` right away, unless it would move an access-point cover; then
 * it hands `confirm` a localized request that runs `action` once accepted.
 * `label` overrides the friendly names in the question.
 */
export function guardCoverMotion(
	entityIds: string[],
	open: boolean,
	action: () => void,
	confirm: (request: CoverConfirmation) => void,
	label?: string
) {
	const $states = get(states);
	const access = entityIds.filter(
		(entityId) => entityControllable($states?.[entityId]) && coverIsAccessPoint($states?.[entityId])
	);
	if (!access.length) return action();
	const $lang = get(lang);
	const names =
		label ??
		access.map((entityId) => $states?.[entityId]?.attributes?.friendly_name || entityId).join(', ');
	confirm({
		title: fill($lang(open ? 'hearth_open_cover_question' : 'hearth_close_cover_question'), {
			label: names
		}),
		message: $lang('hearth_cover_access_point_confirm'),
		confirmLabel: $lang(open ? 'hearth_open' : 'hearth_close'),
		action
	});
}
