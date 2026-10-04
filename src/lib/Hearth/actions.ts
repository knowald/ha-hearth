import { get } from 'svelte/store';
import { states } from '$lib/core/ha/entities';
import { lang } from '$lib/core/i18n';
import { controlOverrides, runAction, type HaAction } from '$lib/core/ha/commands';
import { toggleDevice, toggleEntity } from '$lib/core/domains/entity';
import { blindPositionFor, guardCoverMotion, toggleBlind } from '$lib/core/domains/cover';
import { guardLockCommand } from '$lib/core/domains/lock';
import { openEntityDetail, type DetailOptions } from './details';
import { currentRoom, hearthConfig, requestConfirmation } from './store';
import type { HearthRoom } from './types';

/*
 * The dashboard half of configured tap and hold actions: core's runAction
 * makes the Home Assistant calls, this supplies pages, popups and the
 * confirmation dialog, which core cannot import.
 */

/** Whether an action replaces what the surface would do on its own. */
export function customAction(action: HaAction | undefined): boolean {
	return action !== undefined && action.action !== 'default';
}

/**
 * The page a navigate action names: its id, its name, or the last segment of
 * a Lovelace path such as `/lovelace/kitchen`.
 */
export function resolvePage(
	rooms: Pick<HearthRoom, 'id' | 'name'>[],
	path: string
): string | undefined {
	const wanted = path.trim();
	const segment = wanted.split(/[?#]/)[0].split('/').filter(Boolean).at(-1) ?? '';
	for (const candidate of [wanted, segment]) {
		const match =
			rooms.find((room) => room.id === candidate) ??
			rooms.find((room) => room.name.toLowerCase() === candidate.toLowerCase());
		if (match) return match.id;
	}
	return undefined;
}

// the same guards a tile tap goes through, so a toggle action on a lock or a
// garage door still asks first
function toggle(entityId: string, label?: string) {
	const domain = entityId.split('.')[0];
	if (domain === 'lock') {
		const locked = get(states)?.[entityId]?.state === 'locked';
		return guardLockCommand(entityId, locked ? 'unlock' : 'lock', requestConfirmation, label);
	}
	if (domain === 'cover') {
		const opening = blindPositionFor(entityId, get(states), get(controlOverrides)) === 0;
		return guardCoverMotion(
			[entityId],
			opening,
			() => toggleBlind(entityId, opening),
			requestConfirmation,
			label
		);
	}
	if (!toggleEntity(entityId)) toggleDevice(entityId);
}

export interface ActionSurface {
	/** The tile's or widget's entity, if it has one. */
	entity?: string;
	/** The configured display name, which outranks the friendly name. */
	name?: string;
	/** What the surface does without a configured action. */
	fallback: () => void;
	/** How more-info opens the surface's own entity. */
	detail?: DetailOptions;
}

/** Runs a configured tap or hold action from a tile or widget. */
export function runSurfaceAction(action: HaAction | undefined, surface: ActionSurface) {
	runAction(action, {
		entity: surface.entity,
		fallback: surface.fallback,
		toggle: (entityId) => toggle(entityId, entityId === surface.entity ? surface.name : undefined),
		moreInfo: (entityId) =>
			entityId === surface.entity
				? openEntityDetail(entityId, surface.name, surface.detail)
				: openEntityDetail(entityId),
		navigate: (path) => {
			const roomId = resolvePage(get(hearthConfig).rooms, path);
			if (roomId) currentRoom.set(roomId);
		},
		confirm: (text, run) => {
			const $lang = get(lang);
			requestConfirmation({
				title: text ?? $lang('hearth_action_confirm_title'),
				// the tile or widget the action belongs to
				message:
					surface.name ||
					(surface.entity && get(states)?.[surface.entity]?.attributes?.friendly_name) ||
					surface.entity ||
					'',
				confirmLabel: $lang('hearth_run'),
				action: run
			});
		}
	});
}
