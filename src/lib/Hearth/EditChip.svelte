<script lang="ts">
	import { ICON } from './iconSizes';
	import Icon from './Icon.svelte';

	let {
		label,
		onedit,
		kind = undefined,
		start = false
	}: {
		/** The edit button's accessible name, naming what it edits. */
		label: string;
		onedit: () => void;
		/** A visible word for what the chip belongs to, for a container whose children carry chips too. */
		kind?: string;
		/** Sits at the leading corner, clear of the chips of the cards inside it. */
		start?: boolean;
	} = $props();
</script>

<!-- the drag handle must NOT stop propagation - SortableJS listens on the container -->
<div class="chip" class:start>
	<span class="drag-handle"><Icon name="drag_indicator" size={ICON.inline} /></span>
	<button
		type="button"
		class="pencil pressable"
		aria-label={label}
		onclick={(event) => {
			event.stopPropagation();
			onedit();
		}}
		onpointerdown={(event) => event.stopPropagation()}
	>
		<Icon name="edit" size={ICON.inline} />
	</button>
	{#if kind}<span class="kind" aria-hidden="true">{kind}</span>{/if}
</div>

<style>
	/* straddles the top edge so it covers a border, not a title */
	.chip {
		position: absolute;
		top: -12px;
		right: 12px;
		z-index: var(--h-layer-chip);
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 8px;
		border-radius: var(--h-radius-tight);
		/* solid, not a color-mix: older tablet webviews drop the whole
		   declaration and the chip becomes invisible over the card */
		background: var(--h-sheet-0);
		border: 1px solid rgb(var(--h-accent-rgb) / calc(0.35 * var(--h-accent-scale)));
		color: var(--h-text-2);
	}

	.chip.start {
		right: auto;
		left: 12px;
	}

	.kind {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 1px;
		text-transform: uppercase;
	}

	.drag-handle {
		position: relative;
		cursor: grab;
		display: inline-flex;
		/* the browser would take a touch on the handle as a scroll */
		touch-action: none;
	}

	.pencil {
		position: relative;
		cursor: pointer;
		display: inline-flex;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
	}

	@media (hover: hover) {
		.pencil:hover {
			color: var(--h-accent-text);
		}
	}

	/* see breakpoints.ts */
	@media (max-width: 900px) {
		.chip {
			top: -10px;
			right: 8px;
			padding: 4px 6px;
			gap: 2px;
		}

		.chip.start {
			right: auto;
			left: 8px;
		}
	}

	/*
	 * Finger-sized hit areas around the small visible icons. The two sit a
	 * gap apart, so each area grows away from the other: the handle's to the
	 * left, the pencil's to the right, meeting in the middle of the gap.
	 */
	@media (pointer: coarse) {
		.chip {
			gap: 4px;
		}

		.drag-handle::before,
		.pencil::before {
			content: '';
			position: absolute;
			top: 50%;
			/* capped so a small interface scale cannot spread it over the neighbours */
			width: min(var(--h-touch-target), 56px);
			height: min(var(--h-touch-target), 56px);
			transform: translateY(-50%);
		}

		.drag-handle::before {
			right: -2px;
		}

		.pencil::before {
			left: -2px;
		}
	}
</style>
