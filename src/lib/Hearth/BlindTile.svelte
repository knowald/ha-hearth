<script lang="ts">
	import { ICON } from './iconSizes';
	import Ripple from '$lib/ui/actions/ripple';
	import { lang } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import type { SliderUpdateMode } from '$lib/core/app/configuration';
	import { capitalize, PRESS_RIPPLE } from './config';
	import { hearthEditMode, popup, requestConfirmation } from './store';
	import {
		blindPositionFor,
		coverIsAccessPoint,
		guardCoverMotion,
		setBlindPosition,
		toggleBlind
	} from '$lib/core/domains/cover';
	import { controlOverrides, pendingEntities } from '$lib/core/ha/commands';
	import { entityAvailability, entityControllable } from '$lib/core/ha/entities';
	import Icon from './Icon.svelte';
	import TuneButton from './TuneButton.svelte';
	import { horizontalDrag } from './drag';
	import { activateOnKeyboard } from './interaction';
	import { customAction, runSurfaceAction } from './actions';
	import type { HearthAction } from './types';

	let {
		entity,
		name = undefined,
		icon = undefined,
		compact = false,
		readonly = false,
		sliderUpdates = 'continuous',
		showTune = false,
		tapAction = undefined,
		holdAction = undefined,
		onedit = undefined
	}: {
		entity: string;
		name?: string;
		icon?: string;
		compact?: boolean;
		/** display only: taps never send a command */
		readonly?: boolean;
		sliderUpdates?: SliderUpdateMode;
		/** restores the controls glyph beside the long-press gesture */
		showTune?: boolean;
		tapAction?: HearthAction;
		holdAction?: HearthAction;
		onedit?: () => void;
	} = $props();

	let position = $derived(blindPositionFor(entity, $states, $controlOverrides));
	let availability = $derived(entityAvailability($states?.[entity]));
	let available = $derived(availability === 'available');
	let controllable = $derived(entityControllable($states?.[entity]));
	let open = $derived(position > 0);
	let label = $derived(name || $states?.[entity]?.attributes?.friendly_name || entity);
	let stateText = $derived(
		!available
			? availability === 'missing'
				? $lang('hearth_missing_entity')
				: capitalize($lang(availability))
			: position === 0
				? capitalize($lang('closed'))
				: `${capitalize($lang('open'))} · ${position}%`
	);

	let pending = $derived($pendingEntities[entity] !== undefined);
	// the tile's own tap, hold and drag; configured actions run regardless
	let ownControls = $derived(!readonly && controllable);
	let interactive = $derived(
		$hearthEditMode || ownControls || customAction(tapAction) || customAction(holdAction)
	);
	let accessPoint = $derived(coverIsAccessPoint($states?.[entity]));

	function surface(fallback: () => void) {
		return { entity, name, detail: { icon, sliderUpdates, readonly }, fallback };
	}

	function handleClick() {
		if ($hearthEditMode) return onedit?.();
		runSurfaceAction(tapAction, surface(defaultTap));
	}

	function handleHold() {
		runSurfaceAction(
			holdAction,
			surface(() => ownControls && openControls())
		);
	}

	function defaultTap() {
		if (!ownControls) return;
		const opening = !open;
		guardCoverMotion(
			[entity],
			opening,
			() => toggleBlind(entity, opening),
			requestConfirmation,
			label
		);
	}

	function openControls() {
		popup.set({ kind: 'blind', entity, name: label, icon, sliderUpdates });
	}

	// a door or gate commits only on release, so the drag asks once
	function slide(value: number, commit: boolean) {
		setBlindPosition(entity, value, false);
		if (!commit) return;
		const current = blindPositionFor(entity, $states, {});
		guardCoverMotion(
			[entity],
			value > current,
			() => setBlindPosition(entity, value),
			requestConfirmation,
			label
		);
	}
</script>

<div
	class="tile"
	class:compact
	class:pressable={interactive}
	class:open
	class:unreachable={!controllable}
	class:pending
	data-id={entity}
	role="button"
	tabindex={interactive ? 0 : -1}
	aria-pressed={open}
	use:Ripple={interactive ? PRESS_RIPPLE : { color: 'transparent' }}
	onclick={() => $hearthEditMode && onedit?.()}
	onkeydown={(event) =>
		activateOnKeyboard(event, () =>
			event.shiftKey && !$hearthEditMode ? handleHold() : handleClick()
		)}
	use:horizontalDrag={{
		set: (value, commit) => {
			if (ownControls) slide(value, commit);
		},
		updateMode: accessPoint ? 'release' : sliderUpdates,
		tap: handleClick,
		hold: holdAction?.action === 'none' ? undefined : handleHold,
		disabled: $hearthEditMode || !interactive,
		ignore: '.tune'
	}}
>
	<div class="fill" style:width="{position}%"></div>
	<div class="content">
		<Icon
			name={icon || 'blinds'}
			size={ICON.tile}
			color={!controllable
				? 'var(--h-icon-dim)'
				: open
					? 'var(--h-accent-dim-text)'
					: 'var(--h-icon-dim)'}
		/>
		<div class="copy">
			<div class="name">{label}</div>
			<div class="state" class:open>{stateText}</div>
		</div>
	</div>
	{#if $hearthEditMode && onedit}
		<TuneButton icon="edit" onopen={onedit} alignEdge />
	{:else if showTune && !$hearthEditMode && !readonly && controllable}
		<TuneButton alignEdge onopen={openControls} />
	{/if}
</div>

<style>
	.tile {
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px var(--tile-pad-right, 16px) 16px 16px;
		border-radius: var(--h-radius-md);
		/* pan-y, not none: the horizontal gesture stays ours while a vertical
		   swipe still scrolls the page or an enclosing popover */
		touch-action: pan-y pinch-zoom;
		user-select: none;
		-webkit-user-select: none;
		background: rgb(var(--h-surface-rgb) / calc(0.045 * var(--h-fill-scale)));
		backdrop-filter: var(--h-surface-blur);
		box-shadow: var(--h-card-shadow);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
	}

	.tile.pressable {
		cursor: pointer;
	}

	.tile.compact {
		padding-top: 10px;
		padding-bottom: 10px;
	}

	/* blinds sit in the warm palette like everything else; only their fill
	   intensity separates them from lights */
	.tile.open {
		border-color: rgb(var(--h-line-rgb) / calc(0.09 * var(--h-line-scale)));
	}

	/* offline is a fact, not an alarm: dashed and muted rather than red */
	.tile.unreachable {
		border-style: dashed;
		border-color: rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		background: rgb(var(--h-surface-rgb) / calc(0.015 * var(--h-fill-scale)));
	}

	.tile.unreachable .name {
		color: var(--h-text-5);
	}

	.tile.unreachable .state {
		color: var(--h-text-6);
	}

	.fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: rgb(var(--h-accent-rgb) / calc(0.09 * var(--h-accent-scale)));
	}

	.content {
		position: relative;
		z-index: var(--h-layer-raised);
		display: flex;
		align-items: center;
		gap: 14px;
		min-width: 0;
	}

	.copy {
		min-width: 0;
	}

	.name {
		font-size: var(--h-type-emphasis);
		font-weight: 500;
		color: var(--h-text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.state {
		font-size: var(--h-type-secondary);
		margin-top: 4px;
		color: var(--h-text-3);
	}

	.state.open {
		color: var(--h-accent-dim-text);
	}
</style>
