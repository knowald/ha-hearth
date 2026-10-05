<script module lang="ts">
	/*
	 * Remembered for the session so reopening a floating editor puts it back
	 * where the user left it. One window is open at a time, so one slot.
	 */
	let rememberedPosition: WindowPosition | null = null;
</script>

<script lang="ts">
	import { ICON } from '../iconSizes';
	import type { Snippet } from 'svelte';
	import Ripple from '$lib/ui/actions/ripple';
	import { lang } from '$lib/core/i18n';
	import { finePointer } from '$lib/core/app/pointer';
	import { PRESS_RIPPLE } from '../config';
	import Icon from '../Icon.svelte';
	import CloseButton from '../CloseButton.svelte';
	import { layer } from '$lib/ui/layers';
	import { clampToViewport, windowDrag, type WindowPosition } from '$lib/ui/actions/windowDrag';
	import ScrollEdge from '$lib/ui/ScrollEdge.svelte';
	import { scrollEdges, type ScrollEdges } from '$lib/ui/actions/scrollEdges';
	import { hearthConfig, reportSheetChanges, requestConfirmation } from '../store';
	import { WIDE_QUERY } from '../breakpoints';
	import { confirmDiscard } from './discard';
	import FieldMessages, { describedBy } from './FieldMessages.svelte';
	import './editor-fields.css';
	import '../buttons.css';

	let {
		title,
		children,
		onclose,
		onback,
		ondone,
		doneDisabled = false,
		doneReason = undefined,
		doneLabel = undefined,
		onremove,
		removeLabel = undefined,
		removeTone = 'danger',
		confirmRemove = true,
		onduplicate,
		actions,
		onmoveup,
		onmovedown,
		moveUpDisabled = false,
		moveDownDisabled = false,
		wide = false,
		split = false,
		floating = false,
		dismissible = true,
		dirty = false,
		backKeepsChanges = false
	}: {
		title: string;
		children: Snippet;
		onclose: () => void;
		onback?: () => void;
		ondone: () => void;
		doneDisabled?: boolean;
		/**
		 * Why Done is disabled, shown under it while it is. A sheet that can
		 * block Done passes null while it does not, which keeps the line's
		 * room so the form below never jumps.
		 */
		doneReason?: string | null;
		doneLabel?: string;
		onremove?: () => void;
		removeLabel?: string;
		/** A neutral remove action (one that destroys nothing) runs without asking. */
		removeTone?: 'danger' | 'neutral';
		/** False removes at once; the caller offers an undo instead (see offerUndo). */
		confirmRemove?: boolean;
		onduplicate?: () => void;
		/** More buttons for the footer, after Duplicate. */
		actions?: Snippet;
		onmoveup?: () => void;
		onmovedown?: () => void;
		/** The item already sits first or last where it will land. */
		moveUpDisabled?: boolean;
		moveDownDisabled?: boolean;
		wide?: boolean;
		split?: boolean;
		/** Drop the modal backdrop and let the sheet be dragged over the page. */
		floating?: boolean;
		/** False keeps a backdrop tap from closing the sheet; Escape and the close button still do. */
		dismissible?: boolean;
		/** The form holds staged changes: every exit but Done asks before dropping them. */
		dirty?: boolean;
		/** The back arrow hands the staged changes back to the sheet it returns to, so it never asks. */
		backKeepsChanges?: boolean;
	} = $props();

	const uid = $props.id();
	let blockedReason = $derived(doneDisabled ? doneReason : null);

	// a reload drops the staged changes as surely as a close does
	$effect(() => {
		reportSheetChanges(dirty);
		return () => reportSheetChanges(false);
	});

	function close() {
		confirmDiscard(dirty, onclose);
	}

	function back() {
		if (onback) confirmDiscard(dirty && !backKeepsChanges, onback);
	}

	/*
	 * A backdrop tap closes on click, not pointerdown: closing on the press
	 * would hand the click that follows to whatever lies under the finger. The
	 * press must also start on the backdrop, or a drag out of the sheet (a
	 * text selection, a slider) would close it on release.
	 */
	let pressedBackdrop = false;

	function backdropClick(event: MouseEvent) {
		const pressed = pressedBackdrop;
		pressedBackdrop = false;
		if (dismissible && !floats && pressed && event.target === event.currentTarget) close();
	}

	// long editor forms run off the sheet with no scrollbar to say so
	let bodyCut = $state<ScrollEdges>({ top: false, bottom: false, left: false, right: false });
	let edgeBlur = $derived($hearthConfig.scroll_edge_blur ?? true);

	let sheet = $state<HTMLElement | null>(null);
	let position = $state<WindowPosition>(rememberedPosition ?? { x: 0, y: 0 });

	// a phone has no room beside the window; there the sheet stays a modal
	let wideViewport = $state(false);
	let floats = $derived(floating && wideViewport);

	$effect(() => {
		if (!floating || typeof window.matchMedia !== 'function') return;
		const query = window.matchMedia(WIDE_QUERY);
		const sync = () => (wideViewport = query.matches);
		sync();
		query.addEventListener('change', sync);
		return () => query.removeEventListener('change', sync);
	});

	function place(next: WindowPosition) {
		position = next;
		rememberedPosition = next;
	}

	let settleFrame: number | undefined;

	/*
	 * Floating changes the sheet's size, so the measurement waits a frame for
	 * the class to land - measuring in the same tick reads the modal's width
	 * and parks the window in the middle of the page.
	 */
	function settle() {
		if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
		settleFrame = requestAnimationFrame(() => {
			if (!floats || !sheet) return;
			// window size in the sheet's CSS pixels, which differ under the interface scale
			const zoom = sheet.currentCSSZoom ?? 1;
			const size = { width: sheet.offsetWidth, height: sheet.offsetHeight };
			const viewport = { width: window.innerWidth / zoom, height: window.innerHeight / zoom };
			// first open parks it against the right edge, clear of the rail
			place(
				clampToViewport(
					rememberedPosition ?? { x: viewport.width - size.width - 32, y: 32 },
					size,
					viewport
				)
			);
		});
	}

	$effect(() => {
		if (floats && sheet) settle();
		return () => {
			if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
		};
	});

	/*
	 * A modal sheet takes focus and keeps Tab inside. A form field that asks
	 * for focus with data-autofocus gets it under a mouse or trackpad; otherwise
	 * the done button does, so opening an editor never raises an on-screen
	 * keyboard by itself. data-autofocus="always" is for a field the sheet
	 * exists to fill, where the keyboard is coming anyway.
	 */
	function initialFocus(node: HTMLElement) {
		return (
			node.querySelector<HTMLElement>('[data-autofocus="always"]') ??
			(finePointer() ? node.querySelector<HTMLElement>('[data-autofocus]') : null) ??
			node.querySelector<HTMLElement>('.header .primary:not(:disabled)')
		);
	}

	function handleRemove() {
		if (removeTone === 'neutral' || !confirmRemove) {
			onremove?.();
			return;
		}
		requestConfirmation({
			title: $lang('hearth_remove_confirm_title'),
			message: $lang('hearth_remove_confirm_message'),
			confirmLabel: removeLabel ?? $lang('remove'),
			action: () => onremove?.()
		});
	}
</script>

<svelte:window onresize={settle} />

<div
	class="overlay"
	class:floating={floats}
	role="presentation"
	onpointerdown={(event) => (pressedBackdrop = event.target === event.currentTarget)}
	onclick={backdropClick}
	use:layer={{ close, trap: !floats, initialFocus: !floating && initialFocus }}
>
	<div
		class="sheet"
		class:wide
		class:floating={floats}
		bind:this={sheet}
		style={floats ? `transform: translate(${position.x}px, ${position.y}px)` : undefined}
		role="dialog"
		aria-modal={floats ? 'false' : 'true'}
		aria-label={title}
	>
		<div
			class="header"
			class:handle={floats}
			class:captioned={doneReason !== undefined}
			use:windowDrag={{
				position: () => position,
				size: () => ({ width: sheet?.offsetWidth ?? 0, height: sheet?.offsetHeight ?? 0 }),
				move: place,
				disabled: !floats,
				ignore: 'button'
			}}
		>
			{#if floats}
				<Icon name="drag_indicator" size={ICON.control} />
			{/if}
			{#if onback}
				<button type="button" class="icon-button" aria-label={$lang('back')} onclick={back}>
					<Icon name="arrow_back" size={ICON.tile} />
				</button>
			{/if}
			<div class="title">{title}</div>
			{#if onmoveup || onmovedown}
				<div class="move-actions">
					{#if onmoveup}
						<button
							type="button"
							class="icon-button"
							title={$lang('hearth_move_up')}
							aria-label={$lang('hearth_move_up')}
							disabled={moveUpDisabled}
							onclick={onmoveup}
						>
							<Icon name="arrow_upward" size={ICON.control} />
						</button>
					{/if}
					{#if onmovedown}
						<button
							type="button"
							class="icon-button"
							title={$lang('hearth_move_down')}
							aria-label={$lang('hearth_move_down')}
							disabled={moveDownDisabled}
							onclick={onmovedown}
						>
							<Icon name="arrow_downward" size={ICON.control} />
						</button>
					{/if}
				</div>
			{/if}
			<button
				type="button"
				class="hearth-button primary pressable"
				disabled={doneDisabled}
				aria-describedby={describedBy(`${uid}-done`, undefined, undefined, blockedReason)}
				use:Ripple={PRESS_RIPPLE}
				onclick={() => !doneDisabled && ondone()}
			>
				{doneLabel ?? $lang('done')}
			</button>
			<CloseButton onclick={close} />
		</div>
		{#if doneReason !== undefined}
			<div class="done-reason">
				<FieldMessages id="{uid}-done" warning={blockedReason} />
			</div>
		{/if}
		<div class="body-wrap">
			<div class="body" class:split use:scrollEdges={{ report: (edges) => (bodyCut = edges) }}>
				{@render children()}
			</div>
			{#if edgeBlur}
				<ScrollEdge edge="top" size={72} active={bodyCut.top} />
				<ScrollEdge edge="bottom" size={72} active={bodyCut.bottom} />
			{/if}
		</div>
		{#if onremove || onduplicate || actions}
			<div class="footer">
				{#if onremove}
					<button
						type="button"
						class="hearth-button pressable"
						class:danger={removeTone === 'danger'}
						class:secondary={removeTone === 'neutral'}
						use:Ripple={PRESS_RIPPLE}
						onclick={handleRemove}
					>
						{removeLabel ?? $lang('remove')}
					</button>
				{/if}
				{@render actions?.()}
				{#if onduplicate}
					<button
						type="button"
						class="hearth-button secondary pressable duplicate"
						use:Ripple={PRESS_RIPPLE}
						onclick={onduplicate}
					>
						{$lang('hearth_duplicate')}
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: var(--h-layer-sheet);
		background: var(--h-overlay);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.sheet {
		width: min(760px, calc(100 * var(--h-vw) - 32px));
		height: min(760px, calc(100 * var(--h-dvh) - 48px));
		display: flex;
		flex-direction: column;
		background: radial-gradient(680px 440px at 25% -10%, var(--h-sheet-0), var(--h-sheet-1) 60%);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		border-radius: var(--h-radius-xl);
		box-shadow: var(--h-shadow-layer);
		color: var(--h-text-1);
		font-family: var(--h-font-ui);
		overflow: hidden;
	}

	.sheet.wide {
		width: min(1120px, calc(100 * var(--h-vw) - 32px));
	}

	.header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 22px 28px 18px;
		border-bottom: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
		flex: none;
	}

	/* the actions beside it must stay on screen however long the name is */
	.title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: var(--h-type-headline);
		font-weight: 600;
		letter-spacing: -0.3px;
		color: var(--h-text-1);
	}

	/* sits under the header's actions, so it reads as Done's own caption */
	.done-reason {
		flex: none;
		/* one line of small text, held empty while Done is enabled */
		min-height: calc(var(--h-type-small) * 1.4 + 10px);
		padding: 0 28px 10px;
		text-align: right;
		border-bottom: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
	}

	.done-reason :global(.field-warning) {
		margin: 0;
	}

	.header.captioned {
		padding-bottom: 8px;
		border-bottom: none;
	}

	.sheet.floating .done-reason {
		padding: 0 18px 10px;
	}

	.move-actions {
		display: flex;
		align-items: center;
		padding: 2px;
		border-radius: var(--h-radius-xs);
		background: rgb(var(--h-surface-rgb) / calc(0.05 * var(--h-fill-scale)));
	}

	.icon-button {
		display: flex;
		color: var(--h-icon);
		cursor: pointer;
		padding: 8px;
		border-radius: var(--h-radius-xs);
		transition: transform var(--h-motion-fast) ease;
		border: 0;
		background: none;
		font: inherit;
	}

	.icon-button:active:not(:disabled) {
		transform: scale(0.9);
	}

	.icon-button:disabled {
		color: var(--h-icon-dim);
		cursor: default;
	}

	/* the interface scale must not shrink it under a finger */
	@media (pointer: coarse) {
		.icon-button {
			min-width: var(--h-touch-target);
			min-height: var(--h-touch-target);
			align-items: center;
			justify-content: center;
		}
	}

	@media (hover: hover) {
		.icon-button:hover:not(:disabled) {
			color: var(--h-text-3);
		}
	}

	.body-wrap {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
	}

	.body {
		flex: 1;
		min-width: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-content: start;
		column-gap: 18px;
		overflow-x: hidden;
		overflow-y: auto;
		scrollbar-gutter: stable;
		padding: 22px 28px 28px;
	}

	.body.split {
		display: flex;
		padding: 0;
		overflow: hidden;
	}

	.body.split > :global(*) {
		width: 100%;
	}

	/* Structural content keeps the full workspace width; ordinary form fields
	   naturally flow into the two columns. These classes come from the editor
	   snippets rendered into this shared shell. */
	.body > :global(.group-label),
	.body > :global(.type-gallery),
	.body > :global(.editor-layout),
	.body > :global(.preview),
	.body > :global(.filter-row),
	.body > :global(.add-filter),
	.body > :global(.visibility-row),
	.body > :global(.add-row),
	.body > :global(.hint),
	.body > :global(.field-hint),
	.body > :global(.error),
	.body > :global(.elements-editor),
	.body > :global(.presets),
	.body > :global(.save-row),
	.body > :global(.saved-themes),
	.body > :global(.picker-grid),
	.body > :global(.reset),
	.body > :global(.settings),
	.body > :global(.code-field),
	.body > :global(.versions-layout),
	.body > :global(.code-workspace),
	.body > :global(.card-editor-layout) {
		grid-column: 1 / -1;
	}

	.footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		padding: 14px 28px 18px;
		border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
		flex: none;
	}

	.footer .duplicate {
		margin-left: auto;
	}

	/* the page keeps the pointer; only the window itself takes it back */
	.overlay.floating {
		background: none;
		backdrop-filter: none;
		pointer-events: none;
		align-items: flex-start;
		justify-content: flex-start;
	}

	.sheet.floating,
	.sheet.floating.wide {
		pointer-events: auto;
		position: absolute;
		top: 0;
		left: 0;
		width: min(420px, calc(100 * var(--h-vw) - 32px));
		height: min(680px, calc(100 * var(--h-dvh) - 64px));
		box-shadow: var(--h-shadow-layer);
	}

	.sheet.floating .header {
		padding: 16px 18px 14px 14px;
	}

	.sheet.floating .title {
		font-size: var(--h-type-title);
	}

	.sheet.floating .body {
		grid-template-columns: minmax(0, 1fr);
		padding: 18px 20px 24px;
	}

	.header.handle {
		cursor: grab;
		color: var(--h-icon-dim);
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.header.handle:active {
		cursor: grabbing;
	}

	/* see breakpoints.ts */
	@media (max-width: 900px) {
		.overlay {
			align-items: stretch;
			/* the insets keep an installed app's status bar, home indicator and a
			   landscape cutout off the sheet's edges */
			padding: calc(8px + var(--h-safe-top)) calc(8px + var(--h-safe-right))
				calc(8px + var(--h-safe-bottom)) calc(8px + var(--h-safe-left));
		}

		/* stretched rather than sized from the viewport, so it follows the
		   overlay when an on-screen keyboard shrinks the page */
		.sheet {
			width: 100%;
			height: auto;
			border-radius: var(--h-radius-md);
		}

		.header {
			padding: 14px 14px 12px 18px;
		}

		.done-reason {
			padding: 0 18px 10px;
		}

		.title {
			font-size: var(--h-type-title);
		}

		.body {
			grid-template-columns: minmax(0, 1fr);
			padding: 18px;
		}

		.footer {
			padding: 12px 18px 16px;
		}
	}
</style>
