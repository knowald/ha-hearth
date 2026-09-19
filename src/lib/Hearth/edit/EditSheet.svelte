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
	import { PRESS_RIPPLE } from '../config';
	import Icon from '../Icon.svelte';
	import { layer } from '$lib/ui/layers';
	import { clampToViewport, windowDrag, type WindowPosition } from '$lib/ui/actions/windowDrag';
	import './editor-fields.css';

	let {
		title,
		children,
		onclose,
		onback,
		ondone,
		doneDisabled = false,
		onremove,
		removeLabel = undefined,
		onmoveup,
		onmovedown,
		wide = false,
		split = false,
		floating = false
	}: {
		title: string;
		children: Snippet;
		onclose: () => void;
		onback?: () => void;
		ondone: () => void;
		doneDisabled?: boolean;
		onremove?: () => void;
		removeLabel?: string;
		onmoveup?: () => void;
		onmovedown?: () => void;
		wide?: boolean;
		split?: boolean;
		/** Drop the modal backdrop and let the sheet be dragged over the page. */
		floating?: boolean;
	} = $props();

	let confirmRemove = $state(false);
	let confirmTimer: ReturnType<typeof setTimeout>;

	let sheet = $state<HTMLElement | null>(null);
	let position = $state<WindowPosition>(rememberedPosition ?? { x: 0, y: 0 });

	// a phone has no room beside the window; there the sheet stays a modal
	let wideViewport = $state(false);
	let floats = $derived(floating && wideViewport);

	$effect(() => {
		if (!floating || typeof window.matchMedia !== 'function') return;
		const query = window.matchMedia('(min-width: 821px)');
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
			const size = sheet.getBoundingClientRect();
			const viewport = { width: window.innerWidth, height: window.innerHeight };
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

	function handleRemove() {
		clearTimeout(confirmTimer);
		if (confirmRemove) {
			onremove?.();
			return;
		}
		confirmRemove = true;
		confirmTimer = setTimeout(() => (confirmRemove = false), 4000);
	}
</script>

<svelte:window onresize={settle} />

<div
	class="overlay"
	class:floating={floats}
	role="presentation"
	onpointerdown={(event) => !floats && event.target === event.currentTarget && onclose()}
	use:layer={onclose}
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
				<button type="button" class="icon-button" aria-label={$lang('back')} onclick={onback}>
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
							onclick={onmovedown}
						>
							<Icon name="arrow_downward" size={ICON.control} />
						</button>
					{/if}
				</div>
			{/if}
			<button
				type="button"
				class="button primary pressable"
				disabled={doneDisabled}
				use:Ripple={PRESS_RIPPLE}
				onclick={() => !doneDisabled && ondone()}
			>
				{$lang('done')}
			</button>
			<button
				type="button"
				class="icon-button"
				aria-label={$lang('hearth_close')}
				onclick={onclose}
			>
				<Icon name="close" size={ICON.tile} />
			</button>
		</div>
		<div class="body" class:split>
			{@render children()}
		</div>
		{#if onremove}
			<div class="footer">
				<button
					type="button"
					class="button danger pressable"
					class:confirm={confirmRemove}
					use:Ripple={PRESS_RIPPLE}
					onclick={handleRemove}
				>
					{confirmRemove
						? `${removeLabel ?? $lang('remove')} - ${$lang('hearth_are_you_sure')}`
						: (removeLabel ?? $lang('remove'))}
				</button>
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
		width: min(760px, calc(100vw - 32px));
		height: min(760px, calc(100dvh - 48px));
		display: flex;
		flex-direction: column;
		background: radial-gradient(680px 440px at 25% -10%, var(--h-sheet-0), var(--h-sheet-1) 60%);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		border-radius: var(--h-radius-xl);
		box-shadow: 0 30px 80px var(--h-scrim);
		color: var(--h-text-1);
		font-family: var(--h-font-ui);
		overflow: hidden;
	}

	.sheet.wide {
		width: min(1120px, calc(100vw - 32px));
	}

	.header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 22px 28px 18px;
		border-bottom: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
		flex: none;
	}

	.title {
		flex: 1;
		font-size: var(--h-type-headline);
		font-weight: 600;
		letter-spacing: -0.3px;
		color: var(--h-text-1);
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

	.icon-button:active {
		transform: scale(0.9);
	}

	.icon-button:hover {
		color: var(--h-text-3);
	}

	.body {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-content: start;
		column-gap: 18px;
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
	.body > :global(.error),
	.body > :global(.advanced-toggle),
	.body > :global(.elements-editor),
	.body > :global(.presets),
	.body > :global(.save-row),
	.body > :global(.saved-themes),
	.body > :global(.picker-grid),
	.body > :global(.reset),
	.body > :global(.settings),
	.body > :global(.yaml-field),
	.body > :global(.code-workspace),
	.body > :global(.card-editor-layout) {
		grid-column: 1 / -1;
	}

	.footer {
		display: flex;
		align-items: center;
		padding: 14px 28px 18px;
		border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
		flex: none;
	}

	.button {
		border: 1px solid transparent;
		padding: 12px 22px;
		border-radius: var(--h-radius-xs);
		font-size: var(--h-type-body);
		font-weight: 600;
		cursor: pointer;
		user-select: none;
		-webkit-user-select: none;
		font-family: inherit;
	}

	.button.primary {
		background: linear-gradient(135deg, var(--h-accent-deep), var(--h-accent-bright));
		color: var(--h-on-accent);
	}

	.button.primary:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.button.danger {
		background: rgb(var(--h-bad-rgb) / calc(0.16 * var(--h-accent-scale)));
		color: var(--h-bad-text);
	}

	.button.danger.confirm {
		border-color: var(--h-bad-text);
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
		width: min(420px, calc(100vw - 32px));
		height: min(680px, calc(100dvh - 64px));
		box-shadow: var(--h-shadow-layer);
	}

	.sheet.floating .header {
		padding: 16px 18px 14px 14px;
	}

	.sheet.floating .title {
		font-size: var(--h-type-title);
	}

	.sheet.floating .body {
		grid-template-columns: 1fr;
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

	@media (max-width: 820px) {
		.overlay {
			align-items: stretch;
			padding: 8px;
		}

		.sheet {
			width: 100%;
			height: calc(100dvh - 16px);
			border-radius: var(--h-radius-md);
		}

		.header {
			padding: 14px 14px 12px 18px;
		}

		.title {
			font-size: var(--h-type-title);
		}

		.body {
			grid-template-columns: 1fr;
			padding: 18px;
		}

		.footer {
			padding: 12px 18px 16px;
		}
	}
</style>
