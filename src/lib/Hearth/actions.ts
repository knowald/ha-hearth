import { get } from 'svelte/store';
import { entityControllable, states } from '$lib/core/ha/entities';
import { lang } from '$lib/core/i18n';
import { controlOverrides, runAction, type HaAction } from '$lib/core/ha/commands';
import { toggleDevice, toggleEntity } from '$lib/core/domains/entity';
import {
	blindPositionFor,
	coverIsAccessPoint,
	guardCoverMotion,
	toggleBlind
} from '$lib/core/domains/cover';
import { guardLockCommand } from '$lib/core/domains/lock';
import { showPage } from './pages';
import { openEntityDetail, type DetailOptions } from './details';
import { requestConfirmation } from './store';

/*
 * The dashboard half of configured tap and hold actions: core's runAction
 * makes the Home Assistant calls, this supplies pages, popups and the
 * confirmation dialog, which core cannot import.
 */

/** Whether an action replaces what the surface would do on its own. */
export function customAction(action: HaAction | undefined): boolean {
	return action !== undefined && action.action !== 'default';
}

function sendsCommand(action: HaAction): boolean {
	return action.action === 'toggle' || action.action === 'perform-action';
}

/**
 * Whether an action replaces the surface's own behaviour and can run there: a
 * read-only surface sends no command, configured or not.
 */
export function actionRuns(action: HaAction | undefined, readonly = false): boolean {
	return customAction(action) && !(readonly && sendsCommand(action!));
}

/**
 * Whether a tap flips the tile's own entity, so its on state is what the tap
 * presses: no action, `default`, or a toggle of that entity.
 */
export function tapToggles(action: HaAction | undefined, entity: string): boolean {
	return (
		!customAction(action) ||
		(action!.action === 'toggle' && (!action!.entity || action!.entity === entity))
	);
}

/** Whether a toggle of this entity asks on its own: an unlock, or a door or gate moving. */
function guardAsks(entityId: string | undefined): boolean {
	const entity = entityId ? get(states)?.[entityId] : undefined;
	if (!entity) return false;
	if (entityId!.startsWith('lock.')) return entity.state === 'locked';
	return entityId!.startsWith('cover.') && entityControllable(entity) && coverIsAccessPoint(entity);
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

const CONFIRM_LABELS: Record<HaAction['action'], string> = {
	default: 'hearth_continue',
	none: 'hearth_continue',
	toggle: 'toggle',
	'more-info': 'hearth_open',
	'perform-action': 'hearth_run',
	navigate: 'hearth_go',
	url: 'hearth_open'
};

export interface ActionSurface {
	/** The tile's or widget's entity, if it has one. */
	entity?: string;
	/** The configured display name, which outranks the friendly name. */
	name?: string;
	/** What the surface does without a configured action. */
	fallback: () => void;
	/** Set when the fallback toggles the entity, so its own guards apply to it. */
	fallbackToggles?: boolean;
	/** Display only: actions that send a command do nothing. */
	readonly?: boolean;
	/** How more-info opens the surface's own entity. */
	detail?: DetailOptions;
}

/** Runs a configured tap or hold action from a tile or widget. */
export function runSurfaceAction(action: HaAction | undefined, surface: ActionSurface) {
	if (action && surface.readonly && sendsCommand(action)) return;
	const toggled =
		action?.action === 'toggle'
			? (action.entity ?? surface.entity)
			: action?.action === 'default' && surface.fallbackToggles
				? surface.entity
				: undefined;
	// the lock or garage door question is enough; a second one before it is noise
	if (action?.confirmation && guardAsks(toggled)) action = { ...action, confirmation: undefined };
	runAction(action, {
		entity: surface.entity,
		fallback: surface.fallback,
		toggle: (entityId) => toggle(entityId, entityId === surface.entity ? surface.name : undefined),
		moreInfo: (entityId) =>
			entityId === surface.entity
				? openEntityDetail(entityId, surface.name, surface.detail)
				: openEntityDetail(entityId),
		navigate: (path) => showPage(path),
		confirm: (confirmed, run) => {
			const $lang = get(lang);
			const { confirmation } = confirmed;
			requestConfirmation({
				title:
					typeof confirmation === 'object'
						? confirmation.text
						: $lang('hearth_action_confirm_title'),
				// the tile or widget the action belongs to
				message:
					surface.name ||
					(surface.entity && get(states)?.[surface.entity]?.attributes?.friendly_name) ||
					$lang('hearth_action_confirm_message'),
				confirmLabel: $lang(CONFIRM_LABELS[confirmed.action]),
				action: run
			});
		}
	});
}
