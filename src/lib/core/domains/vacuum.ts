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
