import type { Connection } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';
import { fetchDisplayRegistry } from './registry';

function fakeConnection(answers: Record<string, unknown>) {
	return {
		sendMessagePromise: async ({ type }: { type: string }) => {
			const answer = answers[type];
			if (answer instanceof Error) throw answer;
			return answer;
		}
	} as unknown as Connection;
}

const AREAS = [{ area_id: 'office', name: 'Office' }];
const DEVICES = [{ id: 'hub', area_id: 'office', name: 'Hub' }];

describe('fetchDisplayRegistry', () => {
	it('maps the compact display rows to entity placements', async () => {
		const registry = await fetchDisplayRegistry(
			fakeConnection({
				'config/area_registry/list': AREAS,
				'config/device_registry/list': DEVICES,
				'config/entity_registry/list_for_display': {
					entity_categories: {},
					entities: [
						{ ei: 'light.desk', ai: 'office' },
						{ ei: 'switch.plug', di: 'hub' }
					]
				}
			})
		);
		expect(registry).toEqual({
			areas: AREAS,
			devices: DEVICES,
			entities: [
				{ entity_id: 'light.desk', area_id: 'office', device_id: null },
				{ entity_id: 'switch.plug', area_id: null, device_id: 'hub' }
			]
		});
	});

	it('falls back to the full entity registry on a core without the display list', async () => {
		const full = [{ entity_id: 'light.desk', area_id: 'office', device_id: null }];
		const registry = await fetchDisplayRegistry(
			fakeConnection({
				'config/area_registry/list': AREAS,
				'config/device_registry/list': DEVICES,
				'config/entity_registry/list_for_display': new Error('unknown_command'),
				'config/entity_registry/list': full
			})
		);
		expect(registry.entities).toEqual(full);
	});
});
