import type { GroupOptions, SortableEvent } from 'sortablejs';
import type { Action, ActionReturn } from 'svelte/action';

export interface DndReceiveDetail {
	id: string;
	newIndex: number;
	alt?: boolean;
}

/**
 * Handles the cross-container event emitted by `sortable`. The event bubbles,
 * so stop it at the innermost drop zone before forwarding its payload.
 */
export const onDndReceive: Action<HTMLElement, (detail: DndReceiveDetail) => void> = (
	node,
	handler
) => {
	let current = handler;
	const listener = (event: Event) => {
		event.stopPropagation();
		current((event as CustomEvent<DndReceiveDetail>).detail);
	};
	node.addEventListener('dndreceive', listener);
	return {
		update(next) {
			current = next;
		},
		destroy() {
			node.removeEventListener('dndreceive', listener);
		}
	};
};

export interface DndOptions<T = unknown> {
	group: string | GroupOptions;
	animation?: number;
	disabled?: boolean;
	ghostClass?: string;
	chosenClass?: string;
	dragClass?: string;
	handle?: string;
	filter?: string;
	fallbackOnBody?: boolean;
	swapThreshold?: number;
	direction?: 'vertical' | 'horizontal';
	/** Called when drag starts */
	onStart?: (evt: SortableEvent) => void;
	/**
	 * Called when drag ends with the reordered items array.
	 * For cross-zone moves, called on the target zone with items including the new element.
	 */
	onFinalize: (newItems: T[], evt: SortableEvent) => void;
	/** Called on the source zone when an item is moved to another zone */
	onRemove?: (removedId: string, evt: SortableEvent) => void;
	/** Attribute on child elements that holds the item ID. Defaults to 'data-id'. */
	idAttr?: string;
	/** The current items array - needed to map DOM order back to data */
	items: T[];
	/** Key on each item that holds its unique ID. Defaults to 'id'. */
	itemKey?: string;
	/** When true, dropping while Alt is held duplicates the item instead of moving it. */
	clone?: boolean;
	/** Transform run on the duplicate produced by an Alt-drop, e.g. to assign it a fresh id. */
	cloneItem?: (item: T) => T;
}

/**
 * SortableJS sizes and moves the touch-drag ghost in screen pixels, which
 * only works while the ghost renders at zoom 1, but the ghost's own padding,
 * border and gap should keep the page zoom. So the ghost becomes a bare shell
 * at zoom 1 (ZOOM_GHOST_SHELL, styled by the Hearth theme) and its content
 * moves into a copy of the element that takes the zoom back.
 */
export const ZOOM_GHOST_SHELL = 'sortable-zoom-shell';

// the `.sortable-zoom-shell` rules live in DRAG_GHOST_CSS in Hearth's shell/ThemeStyle.svelte
export function nestZoomedGhost(ghost: HTMLElement, item: HTMLElement) {
	const inner = ghost.cloneNode(false) as HTMLElement;
	inner.style.cssText = item.style.cssText;
	inner.classList.remove('sortable-fallback');
	inner.append(...ghost.childNodes);
	ghost.className = `sortable-fallback ${ZOOM_GHOST_SHELL}`;
	ghost.append(inner);
}

/** Loads SortableJS and the code driving it; also warms the chunk before edit mode. */
export function loadSortable() {
	return import('./sortableInstance');
}

/**
 * Drag-to-reorder for a list. SortableJS loads the first time a list is
 * enabled rather than with the page, since lists are only sortable while
 * editing; until then, and while disabled, the list is left alone.
 */
export function sortable<T>(
	node: HTMLElement,
	options: DndOptions<T>
): ActionReturn<DndOptions<T>> {
	let current = options;
	let instance: ActionReturn<DndOptions<T>> | undefined;
	let loading = false;
	let destroyed = false;

	function attach() {
		if (instance || loading || current.disabled) return;
		loading = true;
		loadSortable()
			.then(({ createSortable }) => {
				if (!destroyed) instance = createSortable(node, current);
			})
			.catch((error) => console.warn('drag and drop unavailable', error))
			.finally(() => (loading = false));
	}

	attach();

	return {
		update(next: DndOptions<T>) {
			current = next;
			if (instance) instance.update?.(next);
			else attach();
		},
		destroy() {
			destroyed = true;
			instance?.destroy?.();
		}
	};
}
