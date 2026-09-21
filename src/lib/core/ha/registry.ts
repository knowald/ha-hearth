import { get } from 'svelte/store';
import { connection } from './connection';

export interface RegistryFloor {
	floor_id: string;
	name: string;
	level?: number | null;
	icon?: string | null;
}

export interface RegistryArea {
	area_id: string;
	name: string;
	icon?: string | null;
	floor_id?: string | null;
	aliases?: string[];
	temperature_entity_id?: string | null;
	humidity_entity_id?: string | null;
}

export interface RegistryDevice {
	id: string;
	area_id: string | null;
}

export interface RegistryEntity {
	entity_id: string;
	area_id: string | null;
	device_id: string | null;
	disabled_by: string | null;
	hidden_by: string | null;
	// "config" or "diagnostic" for entities Home Assistant keeps off dashboards
	entity_category?: string | null;
	original_name?: string | null;
	name?: string | null;
}

export interface RegistrySnapshot {
	floors: RegistryFloor[];
	areas: RegistryArea[];
	devices: RegistryDevice[];
	entities: RegistryEntity[];
}

/** One snapshot of the floor, area, device and entity registries. */
export async function fetchRegistry(): Promise<RegistrySnapshot> {
	const conn = get(connection);
	if (!conn) throw new Error('Not connected to Home Assistant');
	const list = async <T>(type: string): Promise<T[]> => {
		const result = await conn.sendMessagePromise<T[]>({ type });
		return Array.isArray(result) ? result : [];
	};
	const [floors, areas, devices, entities] = await Promise.all([
		// floors arrived in 2024.4; an older core answers with an unknown-command
		// error, which only costs the pages their grouping
		list<RegistryFloor>('config/floor_registry/list').catch(() => []),
		list<RegistryArea>('config/area_registry/list'),
		list<RegistryDevice>('config/device_registry/list'),
		list<RegistryEntity>('config/entity_registry/list')
	]);
	return { floors, areas, devices, entities };
}
