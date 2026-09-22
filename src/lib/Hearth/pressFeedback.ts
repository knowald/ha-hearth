import type { Action } from 'svelte/action';
import { derived, writable } from 'svelte/store';
import { pendingEntities } from '$lib/core/ha/commands';

// per entity, the control whose press sent the command now in flight
const pressed = writable<Record<string, object>>({});

// a press whose command never went out (refused, or no state change) must not
// light up again when a later command from elsewhere marks the entity pending
const PRESS_MEMORY_MS = 6000;

function release(entity: string, token: object) {
	pressed.update((current) => {
		if (current[entity] !== token) return current;
		const next = { ...current };
		delete next[entity];
		return next;
	});
}

/**
 * Puts the global `.pending` pulse on the control that sent a command, not on
 * its siblings, until the entity confirms. The class is toggled directly, so
 * the element must not also bind `class:pending`.
 */
export const pressFeedback: Action<HTMLElement, string> = (node, initial) => {
	let entity = initial;
	const token = {};
	let timer: ReturnType<typeof setTimeout> | undefined;
	let lit = false;

	// native listeners on the node run before Svelte's delegated handlers, so
	// the press is recorded before the command marks the entity pending. Keys
	// count too: composite role=button controls act on keydown, not click
	function handleKey(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') handlePress();
	}

	function handlePress() {
		pressed.update((current) => ({ ...current, [entity]: token }));
		clearTimeout(timer);
		timer = setTimeout(() => release(entity, token), PRESS_MEMORY_MS);
	}

	const unsubscribe = derived([pendingEntities, pressed], ([$pending, $pressed]) => ({
		mine: $pressed[entity] === token,
		pending: $pending[entity] !== undefined
	})).subscribe(({ mine, pending }) => {
		const next = mine && pending;
		if (lit && !next && mine) release(entity, token);
		lit = next;
		node.classList.toggle('pending', next);
	});

	node.addEventListener('click', handlePress);
	node.addEventListener('keydown', handleKey);
	return {
		update(next) {
			entity = next;
		},
		destroy() {
			clearTimeout(timer);
			release(entity, token);
			unsubscribe();
			node.removeEventListener('click', handlePress);
			node.removeEventListener('keydown', handleKey);
		}
	};
};
