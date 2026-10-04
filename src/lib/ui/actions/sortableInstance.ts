import Sortable from 'sortablejs';
import type { Options as SortableOptions, SortableEvent } from 'sortablejs';
import type { ActionReturn } from 'svelte/action';
import { get } from 'svelte/store';
import { motion } from '$lib/core/app/motion';
import { coarsePointer } from '$lib/core/app/pointer';
import { MOTION } from '$lib/core/theme';
import { nestZoomedGhost, type DndOptions } from './sortable';

// Alt-drag clone: SortableJS's onEnd/onAdd events don't reliably expose which
// modifier keys were held at drop time, so track Alt via window listeners
// into a module-level flag instead.
let altPressed = false;
if (typeof window !== 'undefined') {
	window.addEventListener('keydown', (event) => {
		if (event.key === 'Alt') altPressed = true;
	});
	window.addEventListener('keyup', (event) => {
		if (event.key === 'Alt') altPressed = false;
	});
	// alt-tabbing away mid-drag would otherwise leave the flag stuck on
	window.addEventListener('blur', () => {
		altPressed = false;
	});
}

function getItemId(el: Element, idAttr: string): string {
	return el.getAttribute(idAttr) ?? '';
}

/**
 * Where a dragged element must be restored to. Svelte 5 tracks each-item
 * fragments including their comment anchors, so the revert has to put the
 * element back at its exact original node position (comments included) -
 * restoring by element index can land it on the wrong side of an anchor,
 * which corrupts the each block's fragment ranges and makes every later
 * keyed reorder silently skip the DOM move.
 */
const dragOrigin = new WeakMap<Element, { parent: Node; next: Node | null }>();

function revertToOrigin(draggedEl: Element) {
	const origin = dragOrigin.get(draggedEl);
	if (!origin) return;
	origin.parent.insertBefore(
		draggedEl,
		origin.next && origin.next.parentNode === origin.parent ? origin.next : null
	);
}

/** The SortableJS side of the `sortable` action, loaded once a list is first editable. */
export function createSortable<T>(
	node: HTMLElement,
	options: DndOptions<T>
): ActionReturn<DndOptions<T>> {
	const idAttr = options.idAttr ?? 'data-id';
	const itemKey = options.itemKey ?? 'id';

	// Reads the outer `options` variable (not a captured param) so callbacks
	// always see the latest items/handlers after update() reassigns it. The
	// dashboard deep-clones item arrays on every drag end, so a stale closure
	// here would splice against outdated data and reorder incorrectly.
	function buildSortableOptions(): SortableOptions {
		return {
			group: options.group,
			// the live motion setting gates this in the getter below
			animation: options.animation ?? MOTION.fast,
			disabled: options.disabled ?? false,
			ghostClass: options.ghostClass ?? 'sortable-ghost',
			chosenClass: options.chosenClass ?? 'sortable-chosen',
			dragClass: options.dragClass ?? 'sortable-drag',
			handle: options.handle,
			filter: options.filter,
			fallbackOnBody: options.fallbackOnBody ?? true,
			// native drag and drop does not start from a touch in most mobile
			// webviews; Sortable picks its own fallback on iOS by user agent, but
			// iPadOS reports a desktop Mac one, so the pointer decides
			forceFallback: coarsePointer(),
			swapThreshold: options.swapThreshold ?? 0.65,
			direction: options.direction,

			onStart(evt: SortableEvent) {
				dragOrigin.set(evt.item, {
					parent: evt.item.parentNode as Node,
					next: evt.item.nextSibling
				});
				if (Sortable.ghost && (node.currentCSSZoom ?? 1) !== 1) {
					nestZoomedGhost(Sortable.ghost, evt.item);
				}
				options.onStart?.(evt);
			},

			onEnd(evt: SortableEvent) {
				const { from, to, item: draggedEl, oldIndex, newIndex } = evt;

				if (oldIndex == null || newIndex == null) return;

				const cloning = Boolean(options.clone && altPressed);

				if (from === to) {
					// Same container: revert SortableJS' DOM move so Svelte owns
					// rendering, then notify with the reordered items.
					revertToOrigin(draggedEl);

					const items = [...options.items];
					if (cloning) {
						// keep the source item at oldIndex and insert a duplicate at
						// the drop position; SortableJS computes newIndex after the
						// dragged element left its slot, so a forward drag needs +1
						// to land after the retained original
						const duplicate = options.cloneItem
							? options.cloneItem(items[oldIndex])
							: structuredClone(items[oldIndex]);
						items.splice(newIndex > oldIndex ? newIndex + 1 : newIndex, 0, duplicate);
					} else {
						const [moved] = items.splice(oldIndex, 1);
						items.splice(newIndex, 0, moved);
					}
					options.onFinalize(items, evt);
				} else {
					// Cross-container: the target zone's onAdd has already reverted
					// the DOM (moved draggedEl back to `from`), so it is no longer a
					// child of `to`. Touching the DOM here throws. Only notify the
					// source side; the target is handled via onAdd's dndreceive.
					const movedId = getItemId(draggedEl, idAttr);
					const movedItem = options.items.find(
						(item) => String((item as Record<string, unknown>)[itemKey]) === movedId
					);

					// when cloning, the source keeps its item - only the target
					// side (onAdd) inserts a duplicate
					if (movedItem && !cloning) {
						options.onRemove?.(movedId, evt);
					}
				}
			},

			onAdd(evt: SortableEvent) {
				// An item was added from another container
				const { item: draggedEl, newIndex } = evt;

				if (newIndex == null) return;

				// Revert DOM - put element back to its exact source position so
				// Svelte manages rendering
				revertToOrigin(draggedEl);

				// Read the item ID and find it in the source's data
				const movedId = getItemId(draggedEl, idAttr);

				// We need to insert this item into our items array at newIndex.
				// The actual item data must come from the source - we dispatch a
				// custom event so the consumer can coordinate.
				node.dispatchEvent(
					new CustomEvent('dndreceive', {
						detail: { id: movedId, newIndex, alt: Boolean(options.clone && altPressed) },
						bubbles: true
					})
				);
			}
		};
	}

	const instance = Sortable.create(node, buildSortableOptions());

	// SortableJS animates siblings by diffing screen-pixel rects and then
	// translating in CSS pixels, so under a root zoom every move overshoots by
	// the zoom factor. Sortable reads this option each time it animates, and
	// the zoom can change at runtime, so skip the animation while zoomed.
	let animation = instance.options.animation;
	Object.defineProperty(instance.options, 'animation', {
		configurable: true,
		enumerable: true,
		// reduced motion can switch on while the list is mounted, so read it live too
		get: () => (get(motion) && (node.currentCSSZoom ?? 1) === 1 ? animation : 0),
		set: (value: number | undefined) => {
			animation = value;
		}
	});

	return {
		update(newOptions: DndOptions<T>) {
			// Update mutable options without recreating instance
			if (newOptions.disabled !== options.disabled) {
				instance.option('disabled', newOptions.disabled ?? false);
			}
			if (newOptions.animation !== options.animation) {
				instance.option('animation', newOptions.animation ?? MOTION.fast);
			}
			if (JSON.stringify(newOptions.group) !== JSON.stringify(options.group)) {
				instance.option('group', newOptions.group);
			}
			// Update the options reference so callbacks use fresh data
			options = newOptions;
		},
		destroy() {
			instance.destroy();
		}
	};
}
