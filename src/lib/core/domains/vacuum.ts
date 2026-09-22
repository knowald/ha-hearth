import { get } from 'svelte/store';
import { states } from '../ha/entities';
import { callEntityService, markPending, service, setControlOverride } from '../ha/commands';
import { vacuumPrimaryCommand } from '.';

export function toggleVacuum(entity: string) {
	markPending(entity);
	const command = vacuumPrimaryCommand(get(states)?.[entity]?.state);
	setControlOverride(`active:${entity}`, command === 'return_to_base' ? 0 : 1);
	service('vacuum', command, { entity_id: entity });
}

export type VacuumCommand = 'start' | 'pause' | 'stop' | 'clean_spot' | 'locate' | 'return_to_base';

export function vacuumCommand(entity: string, command: VacuumCommand) {
	callEntityService('vacuum', command, entity);
}

export interface VacuumAction {
	command: 'start' | 'pause' | 'return_to_base' | 'locate';
	/** translation key */
	label: string;
	icon: string;
	primary?: boolean;
}

const START: VacuumAction = { command: 'start', label: 'hearth_start', icon: 'play_arrow' };
const RESUME: VacuumAction = {
	command: 'start',
	label: 'hearth_resume',
	icon: 'play_arrow',
	primary: true
};
const PAUSE: VacuumAction = { command: 'pause', label: 'hearth_pause', icon: 'pause' };
const HOME: VacuumAction = { command: 'return_to_base', label: 'hearth_send_home', icon: 'home' };
const LOCATE: VacuumAction = { command: 'locate', label: 'hearth_locate', icon: 'my_location' };

// VacuumEntityFeature.LOCATE
const LOCATE_FEATURE = 512;

/**
 * The commands that apply to a vacuum in its current state, in one order and
 * wording for every surface that offers them.
 */
export function vacuumActions(state: string | undefined, features = 0): VacuumAction[] {
	const locate = (features & LOCATE_FEATURE) === LOCATE_FEATURE ? [LOCATE] : [];
	switch (state) {
		case 'cleaning':
		case 'returning':
			return [PAUSE, HOME, ...locate];
		case 'paused':
		case 'error':
			return [RESUME, HOME, ...locate];
		case 'idle':
			return [START, HOME, ...locate];
		default:
			return [START, ...locate];
	}
}
