import type { HassEntities } from 'home-assistant-js-websocket';
import { markPending, service, setControlOverride } from '../ha/commands';

/** Optimistic 0-100 speed of a fan; 0 while it is off. */
export function fanSpeedFor(
	entityId: string,
	$states: HassEntities | undefined,
	$overrides: Record<string, number>
): number {
	const speed = $overrides[`fan:${entityId}`];
	if (speed !== undefined) return speed;
	const active = $overrides[`active:${entityId}`];
	const fan = $states?.[entityId];
	const on = active !== undefined ? active > 0 : fan?.state === 'on';
	return on ? Math.round(fan?.attributes?.percentage ?? 0) : 0;
}

export function setFanSpeed(entityId: string, pct: number) {
	setControlOverride(`fan:${entityId}`, pct);
	markPending(entityId);
	if (pct === 0) {
		service('fan', 'turn_off', { entity_id: entityId });
	} else {
		service('fan', 'set_percentage', { entity_id: entityId, percentage: pct });
	}
}
