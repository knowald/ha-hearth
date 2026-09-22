<script lang="ts">
	import { ICON } from './iconSizes';
	import { lang } from '$lib/core/i18n';
	import { entityActiveFor, states } from '$lib/core/ha/entities';
	import { closePopup, popup } from './store';
	import { layer } from '$lib/ui/layers';
	import { controlOverrides, pendingEntities } from '$lib/core/ha/commands';
	import { lightViewFor, toggleLight } from '$lib/core/domains/light';
	import { toggleEntity } from '$lib/core/domains/entity';
	import BlindPopup from './BlindPopup.svelte';
	import CloseButton from './CloseButton.svelte';
	import Switch from './Switch.svelte';
	import FanPopup from './FanPopup.svelte';
	import Icon from './Icon.svelte';
	import LightPopup from './LightPopup.svelte';
	import MediaPopup from './MediaPopup.svelte';
	import DetailPopup from './DetailPopup.svelte';
	import { domainIcon } from '$lib/core/domains';
	import { domainCaption } from './details';

	/*
	 * The header power switch, for the kinds whose sheet is about one on/off
	 * device. A cover has none: moving it is a position with open and close
	 * buttons in the sheet, and a door or gate asks first, which a switch
	 * flipping state would hide.
	 */
	function powerFor(current: NonNullable<typeof $popup>) {
		const entity = current.entity;
		if (current.kind === 'light') {
			return {
				checked: lightViewFor(entity, $states, $controlOverrides).on,
				label: $lang('hearth_toggle_light'),
				toggle: () => toggleLight(entity)
			};
		}
		if (current.kind === 'fan') {
			return {
				checked: entityActiveFor(entity, $states?.[entity], $controlOverrides),
				label: $lang('hearth_toggle_fan'),
				toggle: () => toggleEntity(entity)
			};
		}
		return null;
	}

	let power = $derived($popup ? powerFor($popup) : null);

	// a drag that starts on a slider and ends over the backdrop is not a backdrop tap
	let pressStartedOnBackdrop = false;
</script>

{#if $popup}
	<div
		class="overlay"
		role="presentation"
		onpointerdown={(event) => (pressStartedOnBackdrop = event.target === event.currentTarget)}
		onclick={(event) =>
			event.target === event.currentTarget && pressStartedOnBackdrop && closePopup()}
		use:layer={{
			close: closePopup,
			trap: true,
			initialFocus: (node) => node.querySelector<HTMLElement>('.close-button')
		}}
	>
		{#if $popup.kind === 'media'}
			<!-- the media sheet is full-bleed art with its own chrome -->
			<MediaPopup entity={$popup.entity} name={$popup.name} />
		{:else}
			<div class="sheet" role="dialog" aria-modal="true" aria-label={$popup.name}>
				<div class="header">
					<div class="icon-tile">
						<Icon
							name={$popup.icon || domainIcon($popup.entity)}
							size={ICON.tile}
							color="var(--h-accent-text)"
						/>
					</div>
					<div class="titles">
						<div class="name">{$popup.name}</div>
						<div class="sub">{domainCaption($popup.entity, $lang)}</div>
					</div>
					{#if power}
						<Switch
							checked={power.checked}
							label={power.label}
							pending={$pendingEntities[$popup.entity] !== undefined}
							onchange={power.toggle}
						/>
					{/if}
					<CloseButton onclick={closePopup} />
				</div>

				{#if $popup.kind === 'light'}
					<LightPopup entity={$popup.entity} sliderUpdates={$popup.sliderUpdates} />
				{:else if $popup.kind === 'blind'}
					<BlindPopup entity={$popup.entity} sliderUpdates={$popup.sliderUpdates} />
				{:else if $popup.kind === 'detail'}
					<DetailPopup
						entity={$popup.entity}
						sliderUpdates={$popup.sliderUpdates}
						readonly={$popup.readonly}
					/>
				{:else}
					<FanPopup entity={$popup.entity} />
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.overlay {
		position: absolute;
		inset: 0;
		z-index: var(--h-layer-popup);
		background: var(--h-overlay);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}

	.sheet {
		box-sizing: border-box;
		width: min(440px, 100%);
		max-height: calc(100dvh - 32px);
		overflow-y: auto;
		overscroll-behavior: contain;
		background: linear-gradient(180deg, var(--h-sheet-0), var(--h-sheet-1));
		border: 1px solid rgb(var(--h-accent-rgb) / calc(0.18 * var(--h-accent-scale)));
		border-radius: var(--h-radius-xl);
		padding: var(--h-modal-padding);
		box-shadow: var(--h-shadow-layer);
	}

	.header {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.icon-tile {
		width: 48px;
		height: 48px;
		border-radius: var(--h-radius-sm);
		background: rgb(var(--h-accent-rgb) / calc(0.14 * var(--h-accent-scale)));
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.titles {
		flex: 1;
	}

	.name {
		font-size: var(--h-type-title);
		font-weight: 600;
		color: var(--h-text-1);
	}

	.sub {
		font-size: var(--h-type-secondary);
		color: var(--h-icon);
	}

	/* see breakpoints.ts */
	@media (max-width: 900px) {
		.overlay {
			align-items: flex-end;
			/* a landscape cutout overlaps the edge a full-width sheet reaches to */
			padding: 0 env(safe-area-inset-right) 0 env(safe-area-inset-left);
		}

		.sheet {
			width: 100%;
			max-height: calc(100dvh - 24px);
			border-radius: var(--h-radius-xl) var(--h-radius-xl) 0 0;
			border-bottom: 0;
			padding: 22px 20px calc(24px + env(safe-area-inset-bottom));
		}
	}
</style>
