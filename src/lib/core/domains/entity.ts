import { get } from 'svelte/store';
import { entityActive, entityControllable, getTogglableService, states } from '../ha/entities';
import {
	callEntityService,
	markPending,
	service,
	setControlOverride,
	throttled
} from '../ha/commands';

/** Flips any entity through homeassistant.toggle, with an optimistic active override. */
export function toggleDevice(entityId: string) {
	const entity = get(states)?.[entityId];
	if (!entityControllable(entity)) return;
	setControlOverride(`active:${entityId}`, entityActive(entityId, entity) ? 0 : 1);
	markPending(entityId);
	service('homeassistant', 'toggle', { entity_id: entityId });
}

/**
 * Toggles any entity via its domain's togglable service. Returns false when
 * the domain has none, so callers can open the entity's detail view instead.
 */
export function toggleEntity(entityId: string): boolean {
	const entity = get(states)?.[entityId];
	if (!entityControllable(entity)) return false;
	const togglable = entity && getTogglableService(entity);
	if (!togglable) return false;
	const [domain, name] = togglable.split('.');
	setControlOverride(`active:${entityId}`, entityActive(entityId, entity) ? 0 : 1);
	markPending(entityId);
	service(domain, name, { entity_id: entityId });
	return true;
}

/** Turns any on/off entity on or off, with an optimistic active override. */
export function setEntityActive(entityId: string, on: boolean) {
	const domain = entityId.split('.')[0];
	// group and remote members span domains, so only homeassistant.* covers them
	const target = domain === 'group' || domain === 'remote' ? 'homeassistant' : domain;
	setControlOverride(`active:${entityId}`, on ? 1 : 0);
	callEntityService(target, on ? 'turn_on' : 'turn_off', entityId);
}

/**
 * The slider contract the detail sheets share with the light and cover
 * popups: `value` previews at once through the `<kind>:<entity>` override,
 * and `send` goes out throttled once `commit` is set.
 */
export function setSliderValue(
	entityId: string,
	kind: string,
	value: number,
	commit: boolean,
	send: (value: number) => void
) {
	if (!entityControllable(get(states)?.[entityId])) return;
	setControlOverride(`${kind}:${entityId}`, value);
	if (!commit) return;
	throttled(`${kind}:${entityId}`, () => send(value), 400);
}
