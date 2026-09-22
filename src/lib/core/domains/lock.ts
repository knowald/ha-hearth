import { get } from 'svelte/store';
import { states } from '../ha/entities';
import { fill, lang } from '../i18n';
import { callEntityService, setControlOverride } from '../ha/commands';

export type LockCommand = 'lock' | 'unlock' | 'open';

export interface LockConfirmation {
	title: string;
	message: string;
	confirmLabel: string;
	action: () => void;
}

/**
 * Sends a lock command. Locking runs right away; unlocking and opening the
 * latch let someone in, so those hand `confirm` a localized request that
 * sends the command once accepted. `label` overrides the friendly name.
 */
export function guardLockCommand(
	entityId: string,
	command: LockCommand,
	confirm: (request: LockConfirmation) => void,
	label?: string
) {
	const send = () => {
		if (command !== 'open') setControlOverride(`active:${entityId}`, command === 'unlock' ? 1 : 0);
		callEntityService('lock', command, entityId);
	};
	if (command === 'lock') return send();
	const $lang = get(lang);
	const name = label || get(states)?.[entityId]?.attributes?.friendly_name || entityId;
	const unlocking = command === 'unlock';
	confirm({
		title: $lang(unlocking ? 'hearth_unlock_door_question' : 'hearth_open_door_question'),
		message: fill(
			$lang(unlocking ? 'hearth_unlock_confirm_message' : 'hearth_open_door_confirm_message'),
			{ label: name }
		),
		confirmLabel: $lang(unlocking ? 'hearth_unlock' : 'hearth_open_door'),
		action: send
	});
}
