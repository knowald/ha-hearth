import { get } from 'svelte/store';
import type { Component } from 'svelte';
import { states, getDomain } from '$lib/core/ha/entities';
import { popup } from '../store';

export interface DetailProps {
	entity: string;
}

type Loader = () => Promise<{ default: Component<DetailProps> }>;

/**
 * Per-domain control surfaces for the detail popup. Domains without an entry
 * get the generic readout (state, attributes, history for numeric states).
 */
const DETAILS: Record<string, Loader> = {
	switch: () => import('./Toggle.svelte'),
	input_boolean: () => import('./Toggle.svelte'),
	siren: () => import('./Toggle.svelte'),
	remote: () => import('./Toggle.svelte'),
	group: () => import('./Toggle.svelte'),
	automation: () => import('./Automation.svelte'),
	script: () => import('./Script.svelte'),
	scene: () => import('./Scene.svelte'),
	button: () => import('./Press.svelte'),
	input_button: () => import('./Press.svelte'),
	lock: () => import('./Lock.svelte'),
	input_number: () => import('./Number.svelte'),
	number: () => import('./Number.svelte'),
	input_select: () => import('./Select.svelte'),
	select: () => import('./Select.svelte'),
	input_text: () => import('./Text.svelte'),
	text: () => import('./Text.svelte'),
	input_datetime: () => import('./DateTime.svelte'),
	datetime: () => import('./DateTime.svelte'),
	timer: () => import('./Timer.svelte'),
	counter: () => import('./Counter.svelte'),
	alarm_control_panel: () => import('./Alarm.svelte'),
	water_heater: () => import('./WaterHeater.svelte'),
	humidifier: () => import('./Humidifier.svelte'),
	valve: () => import('./Valve.svelte'),
	lawn_mower: () => import('./LawnMower.svelte'),
	climate: () => import('./Climate.svelte'),
	update: () => import('./Update.svelte'),
	vacuum: () => import('./Vacuum.svelte'),
	camera: () => import('./Camera.svelte'),
	image: () => import('./Image.svelte')
};

export function detailLoader(entityId: string): Loader | undefined {
	return DETAILS[getDomain(entityId) ?? ''];
}

/** Opens the Hearth detail surface for any entity. */
export function openEntityDetail(entityId: string, name?: string) {
	const domain = getDomain(entityId);
	const entity = get(states)?.[entityId];
	const label = name || entity?.attributes?.friendly_name || entityId;
	// these have full popups of their own; the generic sheet has no controls for them
	if (domain === 'light') return popup.set({ kind: 'light', entity: entityId, name: label });
	if (domain === 'fan') return popup.set({ kind: 'fan', entity: entityId, name: label });
	if (domain === 'cover') return popup.set({ kind: 'blind', entity: entityId, name: label });
	if (domain === 'media_player') return popup.set({ kind: 'media', entity: entityId, name: label });
	popup.set({ kind: 'detail', entity: entityId, name: label });
}
