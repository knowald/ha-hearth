import { get } from 'svelte/store';
import type { Component } from 'svelte';
import { states, getDomain } from '$lib/core/ha/entities';
import type { SliderUpdateMode } from '$lib/core/app/configuration';
import { popup } from '../store';

export interface DetailProps {
	entity: string;
	sliderUpdates?: SliderUpdateMode;
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

// domains whose detail sheet only offers what a tap on the tile already does
const TAP_ONLY = new Set([
	'switch',
	'input_boolean',
	'siren',
	'remote',
	'group',
	'button',
	'input_button',
	'scene'
]);

/** Whether the detail sheet offers more than a tap on the entity's tile. */
export function detailOffersMore(entityId: string): boolean {
	return !TAP_ONLY.has(getDomain(entityId) ?? '');
}

export interface DetailOptions {
	/** the opening tile's configured icon */
	icon?: string;
	sliderUpdates?: SliderUpdateMode;
	/** show the state and history only; no control can send a command */
	readonly?: boolean;
}

/** Opens the Hearth detail surface for any entity. */
export function openEntityDetail(entityId: string, name?: string, options: DetailOptions = {}) {
	const domain = getDomain(entityId);
	const entity = get(states)?.[entityId];
	const label = name || entity?.attributes?.friendly_name || entityId;
	const base = { entity: entityId, name: label, ...options };
	// the domain popups are all controls, so a read-only view stays on the generic sheet
	if (options.readonly) return popup.set({ kind: 'detail', ...base });
	// these have full popups of their own; the generic sheet has no controls for them
	if (domain === 'light') return popup.set({ kind: 'light', ...base });
	if (domain === 'fan') return popup.set({ kind: 'fan', ...base });
	if (domain === 'cover') return popup.set({ kind: 'blind', ...base });
	if (domain === 'media_player') return popup.set({ kind: 'media', ...base });
	popup.set({ kind: 'detail', ...base });
}

/** The entity's domain as a caption ("Binary sensor"), translated where a key exists. */
export function domainCaption(entityId: string, $lang: (key: string) => string): string {
	const domain = getDomain(entityId) ?? '';
	const key = `hearth_domain_${domain}`;
	const text = $lang(key);
	if (text !== key) return text;
	const words = domain.replaceAll('_', ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}
