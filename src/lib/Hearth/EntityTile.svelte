<script lang="ts">
	import { ICON } from './iconSizes';
	import Ripple from '$lib/ui/actions/ripple';
	import StateLogic from '$lib/ui/StateLogic.svelte';
	import { lang } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import type { SliderUpdateMode } from '$lib/core/app/configuration';
	import { PRESS_RIPPLE } from './config';
	import { domainDescriptor, domainIcon, entityIsReadout } from '$lib/core/domains';
	import { getTogglableService } from '$lib/core/ha/entities';
	import { hearthEditMode, requestConfirmation } from './store';
	import { controlOverrides, pendingEntities } from '$lib/core/ha/commands';
	import {
		entityActiveFor,
		entityAvailability,
		entityAvailable,
		entityControllable,
		sensorNumber
	} from '$lib/core/ha/entities';
	import { toggleEntity } from '$lib/core/domains/entity';
	import { guardLockCommand } from '$lib/core/domains/lock';
	import { detailOffersMore, openEntityDetail } from '$lib/Hearth/details';
	import BlindTile from './BlindTile.svelte';
	import TileIcon from './TileIcon.svelte';
	import { iconMotionEnabled, iconMotionFor } from './iconMotion';
	import LightTile from './LightTile.svelte';
	import TuneButton from './TuneButton.svelte';
	import { activateOnKeyboard, longPress } from './interaction';
	import { actionRuns, customAction, runSurfaceAction, tapToggles } from './actions';
	import type { HearthAction } from './types';

	let {
		entity,
		name = undefined,
		stateOverride = undefined,
		icon = undefined,
		compact = false,
		readonly = false,
		activeEntity = undefined,
		activeStates = undefined,
		sliderUpdates = 'continuous',
		showTune = false,
		tapAction = undefined,
		holdAction = undefined,
		onedit = undefined
	}: {
		entity: string;
		name?: string;
		/** shown in place of the state text, from a state_template */
		stateOverride?: string;
		icon?: string;
		compact?: boolean;
		/** display only: taps never send a command */
		readonly?: boolean;
		activeEntity?: string;
		activeStates?: string[];
		sliderUpdates?: SliderUpdateMode;
		/** restores the controls glyph beside the long-press gesture */
		showTune?: boolean;
		/** configured actions run as set; `readonly` only quiets the tile's own behaviour */
		tapAction?: HearthAction;
		holdAction?: HearthAction;
		onedit?: () => void;
	} = $props();

	let domain = $derived(entity.split('.')[0]);
	let stateObj = $derived($states?.[entity]);
	let availability = $derived(entityAvailability(stateObj));
	let available = $derived(availability === 'available');
	let controllable = $derived(entityControllable(stateObj));
	let highlightEntity = $derived(activeEntity || entity);
	let highlightState = $derived($states?.[highlightEntity]);
	let on = $derived.by(() => {
		// an unavailable tile stays dim even while its highlight entity is active
		if (!available) return false;
		if (!activeStates?.length)
			return entityActiveFor(highlightEntity, highlightState, $controlOverrides);
		// no optimistic override here: it predicts the domain's on/off, which a
		// custom state list need not follow
		return entityAvailable(highlightState) && activeStates.includes(highlightState!.state);
	});
	// the toggle a tap sends acts on the tile's own entity, whatever lights it
	let pressed = $derived(available && entityActiveFor(entity, stateObj, $controlOverrides));
	let pending = $derived($pendingEntities[entity] !== undefined);
	// a state_template gives way to the availability text and to a command in flight
	let templatedState = $derived(available && !pending ? stateOverride : undefined);
	let label = $derived(name || stateObj?.attributes?.friendly_name || entity);
	let iconColor = $derived(
		!controllable ? 'var(--h-icon-dim)' : on ? 'var(--h-accent-icon)' : 'var(--h-icon-dim)'
	);

	let iconMotion = $derived($iconMotionEnabled && available ? iconMotionFor(stateObj) : undefined);

	let bareModal = $derived(entityIsReadout(entity, stateObj));
	// what a tap earns: a command, a history chart, a domain modal - or, for a
	// readout whose modal would only echo the state, nothing at all
	let tapSurface = $derived(
		stateObj && getTogglableService(stateObj)
			? 'toggle'
			: bareModal
				? sensorNumber(stateObj?.state) !== null
					? 'history'
					: 'none'
				: 'modal'
	);
	// read only means no commands: a history chart still opens, controls do not
	let opens = $derived(!readonly || tapSurface === 'history');
	let interactive = $derived(
		$hearthEditMode ||
			actionRuns(tapAction, readonly) ||
			actionRuns(holdAction, readonly) ||
			(opens && controllable && tapSurface !== 'none')
	);
	let holdDisabled = $derived(
		$hearthEditMode ||
			(customAction(holdAction)
				? !actionRuns(holdAction, readonly) || holdAction?.action === 'none'
				: !opens || !controllable)
	);
	// a toggle whose detail sheet only repeats the tap earns no tune glyph
	let tunable = $derived(
		!readonly &&
			controllable &&
			tapSurface !== 'none' &&
			(tapSurface !== 'toggle' || detailOffersMore(entity))
	);

	let detail = $derived({ icon, sliderUpdates, readonly });

	function openDetail() {
		openEntityDetail(entity, name, detail);
	}

	function handleClick() {
		if ($hearthEditMode) onedit?.();
		else
			runSurfaceAction(tapAction, {
				entity,
				name,
				readonly,
				detail,
				fallbackToggles: tapSurface === 'toggle',
				fallback: defaultTap
			});
	}

	function handleHold() {
		if ($hearthEditMode) return;
		runSurfaceAction(holdAction, { entity, name, readonly, detail, fallback: openControls });
	}

	function defaultTap() {
		if (!controllable || !opens) {
			return;
		} else if (tapSurface === 'history') {
			openDetail();
		} else if (domain === 'lock') {
			guardLockCommand(
				entity,
				stateObj?.state === 'locked' ? 'unlock' : 'lock',
				requestConfirmation,
				label
			);
		} else if (tapSurface === 'toggle') {
			toggleEntity(entity);
		} else if (tapSurface === 'modal') {
			openDetail();
		}
	}

	function openControls() {
		if ($hearthEditMode || !controllable || !opens) return;
		if (tapSurface !== 'none') openDetail();
	}
</script>

{#if domainDescriptor(domain).tile === 'light'}
	<LightTile
		{entity}
		{name}
		{stateOverride}
		{icon}
		{compact}
		{readonly}
		{sliderUpdates}
		{showTune}
		{tapAction}
		{holdAction}
		{onedit}
	/>
{:else if domainDescriptor(domain).tile === 'cover'}
	<BlindTile
		{entity}
		{name}
		{stateOverride}
		{icon}
		{compact}
		{readonly}
		{sliderUpdates}
		{showTune}
		{tapAction}
		{holdAction}
		{onedit}
	/>
{:else}
	<div
		class="tile"
		class:compact
		class:on
		class:unreachable={!controllable}
		class:pending
		class:pressable={interactive}
		data-entity={entity}
		data-domain={domain}
		data-state={stateObj?.state}
		role="button"
		tabindex={interactive ? 0 : -1}
		aria-pressed={tapToggles(tapAction, entity) ? pressed : undefined}
		use:Ripple={interactive ? PRESS_RIPPLE : { color: 'transparent' }}
		use:longPress={{
			hold: handleHold,
			disabled: holdDisabled,
			deferOnTouch: customAction(holdAction)
		}}
		onclick={handleClick}
		onkeydown={(event) => activateOnKeyboard(event, event.shiftKey ? handleHold : handleClick)}
	>
		<div class="content">
			<TileIcon
				name={icon || domainIcon(entity)}
				size={ICON.tile}
				color="var(--tile-accent, {iconColor})"
				fill={on}
				motion={iconMotion}
			/>
			<div class="text">
				<div class="name">{label}</div>
				<div class="state" class:on={on && available}>
					{#if templatedState !== undefined}
						{templatedState}
					{:else if available}
						<StateLogic entity_id={entity} />
					{:else if availability === 'missing'}
						{$lang('hearth_missing_entity')}
					{:else}
						{$lang(availability)}
					{/if}
				</div>
			</div>
		</div>
		{#if $hearthEditMode && onedit}
			<TuneButton icon="edit" onopen={onedit} alignEdge />
		{:else if showTune && !$hearthEditMode && tunable}
			<TuneButton alignEdge onopen={openControls} />
		{/if}
	</div>
{/if}

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
		touch-action: pan-y;
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

	.tile.on {
		background: rgb(var(--h-accent-rgb) / calc(0.07 * var(--h-accent-scale)));
		border-color: rgb(var(--h-accent-rgb) / calc(0.28 * var(--h-accent-scale)));
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

	.content {
		position: relative;
		z-index: var(--h-layer-raised);
		display: flex;
		align-items: center;
		gap: 14px;
		min-width: 0;
	}

	.text {
		min-width: 0;
	}

	.name {
		font-size: var(--h-type-emphasis);
		font-weight: 500;
		color: var(--h-text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.state {
		font-size: var(--h-type-secondary);
		margin-top: 4px;
		color: var(--h-text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.state.on {
		color: var(--h-accent-text);
	}
</style>
