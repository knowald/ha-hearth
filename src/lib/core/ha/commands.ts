import { get, writable } from 'svelte/store';
import { callService, type HassEntity } from 'home-assistant-js-websocket';
import { vibrate } from '../app/haptics';
import { connection, health } from './connection';
import { entityControllable, states } from './entities';

/*
 * The command pipeline: every device call leaves through service() here, with
 * the optimistic overrides, the pending pulse and the failure report around it.
 */

/**
 * Whether commands may leave right now. A dashboard sets this while its layout
 * editor is open, where a tap arranges cards and must never reach a device.
 */
let commandsAllowed: () => boolean = () => true;

export function setCommandGate(allowed: () => boolean) {
	commandsAllowed = allowed;
}

/* optimistic overrides */

/**
 * Optimistic overrides keyed by "<kind>:<entity_id>". While a drag is in
 * progress the dragged value wins over the entity state, then expires so the
 * entity state (updated via websocket) takes back over.
 */
export const controlOverrides = writable<Record<string, number>>({});
const overrideTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export function setControlOverride(key: string, value: number, ttl = 2000) {
	// no command leaves, so nothing should look as if one had
	if (!commandsAllowed()) return;
	clearTimeout(overrideTimers[key]);
	controlOverrides.update((current) => ({ ...current, [key]: value }));
	overrideTimers[key] = setTimeout(() => {
		delete overrideTimers[key];
		controlOverrides.update((current) => {
			const next = { ...current };
			delete next[key];
			return next;
		});
	}, ttl);
}

function clearControlOverridesForEntity(entityId: string) {
	controlOverrides.update((current) => {
		const next = Object.fromEntries(
			Object.entries(current).filter(([key]) => !key.endsWith(`:${entityId}`))
		);
		return Object.keys(next).length === Object.keys(current).length ? current : next;
	});
	for (const key of Object.keys(overrideTimers)) {
		if (!key.endsWith(`:${entityId}`)) continue;
		clearTimeout(overrideTimers[key]);
		delete overrideTimers[key];
	}
}

export function controlValueFor(
	key: string,
	actual: number,
	$overrides: Record<string, number>
): number {
	return $overrides[key] ?? actual;
}

/* throttling */

// trailing-edge throttle per key so drags emit at most one service call per
// interval but the final value is always sent
const throttleState: Record<
	string,
	{ last: number; timer?: ReturnType<typeof setTimeout>; cleanup?: ReturnType<typeof setTimeout> }
> = {};

export function throttled(key: string, fn: () => void, interval = 200) {
	const entry = (throttleState[key] ??= { last: 0 });
	clearTimeout(entry.timer);
	clearTimeout(entry.cleanup);
	const run = () => {
		entry.timer = undefined;
		entry.last = Date.now();
		fn();
		entry.cleanup = setTimeout(() => {
			if (throttleState[key] === entry && !entry.timer) delete throttleState[key];
		}, interval);
	};
	const elapsed = Date.now() - entry.last;
	if (elapsed >= interval) {
		run();
	} else {
		entry.timer = setTimeout(run, interval - elapsed);
	}
}

/* pending */

/**
 * Entities with a command in flight: marked when a discrete command is sent,
 * cleared when the websocket delivers a state change for that entity (or after
 * a timeout for commands that never produce one). Drives the "processing"
 * pulse in the UI. Drag-driven commands are excluded - they already have
 * optimistic overrides.
 */
export const pendingEntities = writable<Record<string, true>>({});
const pendingTimers: Record<string, ReturnType<typeof setTimeout>> = {};
// subscribeEntities replaces an entity's object only when it changed, so an
// identity check per pending entity detects the confirming update
const pendingBaselines: Record<string, HassEntity | undefined> = {};

function clearPending(entityId: string) {
	clearTimeout(pendingTimers[entityId]);
	delete pendingTimers[entityId];
	delete pendingBaselines[entityId];
	pendingEntities.update((current) => {
		if (!(entityId in current)) return current;
		const next = { ...current };
		delete next[entityId];
		return next;
	});
}

export function markPending(entityId: string, ttl = 5000) {
	// no command, no pending glow
	if (!commandsAllowed()) return;
	clearTimeout(pendingTimers[entityId]);
	pendingEntities.update((current) => ({ ...current, [entityId]: true }));
	pendingBaselines[entityId] = get(states)?.[entityId];
	pendingTimers[entityId] = setTimeout(() => clearPending(entityId), ttl);
}

states.subscribe(($states) => {
	if (!$states) return;
	for (const entityId of Object.keys(get(pendingEntities))) {
		const previous = pendingBaselines[entityId];
		if (previous && $states[entityId] && previous !== $states[entityId]) {
			clearPending(entityId);
			clearControlOverridesForEntity(entityId);
		}
	}
});

/* failures */

export interface CommandFailure {
	entityId: string | null;
	detail: string;
}

/** Latest failed device command, rendered by the dashboard as an alert. */
export const commandFailure = writable<CommandFailure | null>(null);
let commandFailureTimer: ReturnType<typeof setTimeout>;

export function dismissCommandFailure() {
	clearTimeout(commandFailureTimer);
	commandFailure.set(null);
}

function reportCommandFailure(entityId: string | null, error: unknown) {
	if (entityId) {
		clearPending(entityId);
		clearControlOverridesForEntity(entityId);
	}
	const detail = error instanceof Error ? error.message : String(error);
	vibrate('error');
	commandFailure.set({ entityId, detail });
	clearTimeout(commandFailureTimer);
	commandFailureTimer = setTimeout(() => commandFailure.set(null), 8000);
}

/* sending */

/** Whether the websocket can carry a message right now. */
export function socketOpen(): boolean {
	const $health = get(health);
	return $health === 'connected' || $health === 'degraded';
}

export function service(
	domain: string,
	name: string,
	data: Record<string, unknown>,
	target?: ActionTarget
) {
	if (!commandsAllowed()) return;
	const named = data.entity_id ?? target?.entity_id;
	const entityId = typeof named === 'string' ? named : null;
	const conn = get(connection);
	// the connection object survives reconnects, so health is the guard: a
	// degraded socket (one stale subscription) still carries commands
	if (!conn || !socketOpen()) {
		reportCommandFailure(entityId, new Error('Not connected to Home Assistant'));
		return;
	}
	callService(conn, domain, name, data, target).catch((error) => {
		console.error(error);
		reportCommandFailure(entityId, error);
	});
}

export function callEntityService(
	domain: string,
	name: string,
	entityId: string,
	data: Record<string, unknown> = {}
) {
	if (!commandsAllowed()) return;
	// the one place every entity command passes, so an unavailable target is
	// refused here rather than in each card, popup and detail sheet
	const $states = get(states);
	if ($states && !entityControllable($states[entityId])) {
		const reason = $states[entityId] ? 'is unavailable' : 'is not known to Home Assistant';
		reportCommandFailure(entityId, new Error(`${entityId} ${reason}`));
		return;
	}
	markPending(entityId);
	service(domain, name, { entity_id: entityId, ...data });
}

/* configured actions */

/** Where a perform-action call goes, in Home Assistant's target shape. */
export type ActionTarget = Partial<
	Record<'entity_id' | 'device_id' | 'area_id' | 'floor_id' | 'label_id', string | string[]>
>;

/** `true` asks a generic question first; `text` asks that instead. */
export type ActionConfirmation = true | { text: string };

/**
 * A tap or hold action in Home Assistant's dashboard vocabulary, so one copied
 * from a Lovelace card means the same here. `default` is whatever the surface
 * does without a configured action.
 */
export type HaAction = { confirmation?: ActionConfirmation } & (
	| { action: 'default' | 'none' }
	// `entity` overrides the surface's own entity
	| { action: 'toggle' | 'more-info'; entity?: string }
	| {
			action: 'perform-action';
			perform_action: string;
			target?: ActionTarget;
			data?: Record<string, unknown>;
	  }
	| { action: 'navigate'; navigation_path: string }
	| { action: 'url'; url_path: string }
);

/** What runAction needs from the dashboard, which core cannot import. */
export interface ActionHost {
	/** The surface's entity, which toggle and more-info act on unless the action names another. */
	entity?: string;
	/** The surface's own behaviour, for no action and for `default`. */
	fallback: () => void;
	toggle: (entityId: string) => void;
	moreInfo: (entityId: string) => void;
	navigate: (path: string) => void;
	/** Asks about `action`, whose confirmation is set, and calls `run` once accepted. */
	confirm: (action: HaAction, run: () => void) => void;
}

/** Calls a `domain.service` on a target, the way a Lovelace perform-action does. */
export function performAction(
	name: string,
	target?: ActionTarget,
	data: Record<string, unknown> = {}
) {
	const [domain, serviceName] = name.split('.');
	if (!domain || !serviceName) return;
	for (const entityId of [target?.entity_id ?? []].flat()) markPending(entityId);
	service(domain, serviceName, data, target);
}

/** Runs a configured action; without one the surface's fallback runs. */
export function runAction(action: HaAction | undefined, host: ActionHost) {
	if (!action) return host.fallback();
	if (action.action === 'none') return;
	// a command the gate would refuse must not ask for confirmation first
	if ((action.action === 'toggle' || action.action === 'perform-action') && !commandsAllowed())
		return;
	const run = () => dispatchAction(action, host);
	if (!action.confirmation) return run();
	host.confirm(action, run);
}

function dispatchAction(action: HaAction, host: ActionHost) {
	switch (action.action) {
		case 'default':
			return host.fallback();
		case 'toggle':
		case 'more-info': {
			const entityId = action.entity ?? host.entity;
			if (!entityId) return;
			return action.action === 'toggle' ? host.toggle(entityId) : host.moreInfo(entityId);
		}
		case 'perform-action':
			return performAction(action.perform_action, action.target, action.data);
		case 'navigate':
			return host.navigate(action.navigation_path);
		case 'url':
			window.open(action.url_path, '_blank', 'noopener');
	}
}

export function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}
