import type { Connection } from 'home-assistant-js-websocket';
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
	name?: string | null;
	// the user's rename wins over the integration's name
	name_by_user?: string | null;
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

/** Where one entity sits: its own area, else its device's. */
export interface EntityPlacement {
	entity_id: string;
	area_id: string | null;
	device_id: string | null;
}

export interface DisplayRegistry {
	areas: RegistryArea[];
	devices: RegistryDevice[];
	entities: EntityPlacement[];
}

// the compact rows of config/entity_registry/list_for_display
interface DisplayEntityRow {
	ei: string;
	ai?: string | null;
	di?: string | null;
}

/**
 * Areas, devices and entity placements, as the entity picker shows them.
 * Reads the compact display list Home Assistant's own frontend loads, which
 * is far smaller than the full entity registry, and falls back to the full
 * list on a core that does not answer it.
 */
export async function fetchDisplayRegistry(conn: Connection): Promise<DisplayRegistry> {
	const list = async <T>(type: string): Promise<T[]> => {
		const result = await conn.sendMessagePromise<T[]>({ type });
		return Array.isArray(result) ? result : [];
	};
	const placements = async (): Promise<EntityPlacement[]> => {
		try {
			const display = await conn.sendMessagePromise<{ entities?: DisplayEntityRow[] } | null>({
				type: 'config/entity_registry/list_for_display'
			});
			if (Array.isArray(display?.entities)) {
				return display.entities.map((row) => ({
					entity_id: row.ei,
					area_id: row.ai ?? null,
					device_id: row.di ?? null
				}));
			}
		} catch {
			// an older core without the display list
		}
		return list<RegistryEntity>('config/entity_registry/list');
	};
	const [areas, devices, entities] = await Promise.all([
		list<RegistryArea>('config/area_registry/list'),
		list<RegistryDevice>('config/device_registry/list'),
		placements()
	]);
	return { areas, devices, entities };
}
