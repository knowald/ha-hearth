<script lang="ts">
	import { ICON } from '../../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import { timer } from '$lib/core/app/clock';
	import { horizontalDrag } from '../../drag';
	import type { OverviewCard } from '../../config';
	import { hearthEditMode, popup } from '../../store';
	import { getHearthInteractionMode } from '../../interaction';
	import {
		controlOverrides,
		controlValueFor,
		pendingEntities,
		setControlOverride
	} from '$lib/core/ha/commands';
	import { seekMedia, toggleMediaPlayback } from '$lib/core/domains/mediaPlayer';
	import Icon from '../../Icon.svelte';
	import Shortcuts from './Shortcuts.svelte';
	import TuneButton from '../../TuneButton.svelte';

	let { card }: { card: Extract<OverviewCard, { type: 'media' }> } = $props();

	const preview = getHearthInteractionMode() === 'preview';

	let entity = $derived(card.entity ? $states?.[card.entity] : undefined);
	let pending = $derived(card.entity !== undefined && $pendingEntities[card.entity] !== undefined);
	let attributes = $derived(entity?.attributes ?? {});
	let playing = $derived(entity?.state === 'playing');
	let hasTrack = $derived(playing || entity?.state === 'paused');
	let duration = $derived(attributes.media_duration ?? 0);
	// the shared second clock drives the position readout while playing
	let now = $derived(playing ? $timer.getTime() : 0);

	// interpolate between websocket updates while playing
	let position = $derived.by(() => {
		const base = attributes.media_position ?? 0;
		if (!playing || !attributes.media_position_updated_at) return base;
		return Math.min(
			duration,
			base + (now - Date.parse(attributes.media_position_updated_at)) / 1000
		);
	});

	let progressFraction = $derived(
		card.entity
			? controlValueFor(
					`seek:${card.entity}`,
					duration ? position / duration : 0,
					$controlOverrides
				)
			: 0
	);
	let progressPercent = $derived(Math.round(progressFraction * 100));

	function formatTime(seconds: number) {
		const whole = Math.max(0, Math.round(seconds));
		const minutes = Math.floor(whole / 60);
		const rest = whole % 60;
		return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
	}

	function endScrub(value: number) {
		if (card.entity) seekMedia(card.entity, value / 100);
	}

	function openPlayer() {
		if (!card.entity || ($hearthEditMode && !preview)) return;
		popup.set({
			kind: 'media',
			entity: card.entity,
			name: attributes.friendly_name ?? 'Media'
		});
	}
</script>

<div
	class="card"
	style:height={card.height ? `${card.height}px` : undefined}
	style:min-height={card.height ? `${card.height}px` : undefined}
>
	{#if attributes.entity_picture}
		<img class="art" src={attributes.entity_picture} alt="" />
	{:else}
		<div class="art placeholder"></div>
	{/if}
	<div class="scrim"></div>
	{#if card.entity}
		<!-- a tap on the art or the track opens the full player; the controls above
		     it keep their own taps, and the keyboard reaches it through the tune
		     button. A plain element, not a button: a clicked button takes focus,
		     and the player restores focus to its opener on close, so focus would
		     land on this hidden, unnamed area instead of a real control -->
		<div class="open-hit" aria-hidden="true" onclick={openPlayer}></div>
	{/if}
	<div class="controls">
		{#if card.entity && card.shortcuts?.length}
			<div class="shortcut-row">
				<Shortcuts
					entity={card.entity}
					shortcuts={card.shortcuts}
					defaultDevice={card.default_device}
				/>
			</div>
		{/if}
		<div class="track-row">
			<div class="track">
				{#if hasTrack}
					<div class="kicker">
						{$lang('hearth_now_playing')}{attributes.friendly_name
							? ` · ${attributes.friendly_name}`
							: ''}
					</div>
				{/if}
				<div class="title">{attributes.media_title ?? $lang('hearth_nothing_playing')}</div>
				<div class="artist">{attributes.media_artist ?? ''}</div>
			</div>
			<!-- in the track row, not a corner, so a short card can't stack it on play -->
			{#if card.entity}
				<span class="tune-slot"><TuneButton onopen={openPlayer} /></span>
			{/if}
			{#if hasTrack}
				<button
					type="button"
					class="play pressable"
					class:pending
					aria-label={playing ? 'Pause' : 'Play'}
					onclick={() => card.entity && toggleMediaPlayback(card.entity)}
				>
					<Icon name={playing ? 'pause' : 'play_arrow'} size={ICON.tile} fill />
				</button>
			{/if}
		</div>
		<div
			class="progress"
			use:horizontalDrag={{
				set: (value) => card.entity && setControlOverride(`seek:${card.entity}`, value / 100, 1500),
				end: endScrub
			}}
		>
			<div class="progress-track"></div>
			<div class="progress-fill" style:width="{progressPercent}%"></div>
			<div class="progress-thumb" style:left="calc({progressPercent}% - 6px)"></div>
		</div>
		<div class="times">
			<span>{formatTime(progressFraction * duration)}</span>
			<span>{formatTime(duration)}</span>
		</div>
	</div>
</div>

<style>
	.card {
		height: 100%;
		min-height: 240px;
		border-radius: var(--h-radius-card);
		overflow: hidden;
		background: rgb(var(--h-surface-rgb) / calc(0.05 * var(--h-fill-scale)));
		backdrop-filter: var(--h-surface-blur);
		box-shadow: var(--h-card-shadow);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.07 * var(--h-line-scale)));
		position: relative;
		flex: 1;
	}

	.art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.art.placeholder {
		background: repeating-linear-gradient(
			135deg,
			var(--h-media-art-1),
			var(--h-media-art-1) 10px,
			var(--h-media-art-2) 10px,
			var(--h-media-art-2) 20px
		);
		opacity: 0.9;
	}

	.scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 35%, var(--h-art-scrim-3));
	}

	.open-hit {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	/* the button's default icon color reads poorly on album art; a variable,
	   not a :global override, so it can't depend on stylesheet order */
	.tune-slot {
		display: inline-flex;
		flex: none;
		--tune-color: var(--h-on-art-1);
	}

	/* the text lets a tap through to the hit area; the controls take their own */
	.controls {
		position: absolute;
		left: 20px;
		right: 20px;
		bottom: 18px;
		pointer-events: none;
	}

	.shortcut-row,
	.tune-slot,
	.play,
	.progress {
		pointer-events: auto;
	}

	.shortcut-row {
		margin-bottom: 12px;
	}

	.track-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.track {
		flex: 1;
		min-width: 0;
	}

	.kicker {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-caption);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-accent-dim-text);
		margin-bottom: 8px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.title {
		font-size: var(--h-type-title);
		font-weight: 600;
		color: var(--h-on-art-1);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.artist {
		font-size: var(--h-type-secondary);
		color: var(--h-on-art-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* transport is the card's one guaranteed control: a real 52px target */
	.play {
		width: 52px;
		height: 52px;
		flex: none;
		border: 0;
		padding: 0;
		font: inherit;
		border-radius: var(--h-radius-pill);
		background: rgb(var(--h-surface-rgb));
		color: var(--h-bg-1);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.progress {
		position: relative;
		height: 18px;
		display: flex;
		align-items: center;
		margin-top: 12px;
		cursor: pointer;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.progress-track {
		position: absolute;
		left: 0;
		right: 0;
		height: 4px;
		border-radius: var(--h-radius-hair);
		background: var(--h-on-art-line);
	}

	.progress-fill {
		position: absolute;
		left: 0;
		height: 4px;
		border-radius: var(--h-radius-hair);
		background: var(--h-accent-deep);
	}

	.progress-thumb {
		position: absolute;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: rgb(var(--h-surface-rgb));
	}

	.times {
		display: flex;
		justify-content: space-between;
		margin-top: 6px;
		font-size: var(--h-type-label);
		color: var(--h-on-art-1);
		font-family: var(--h-font-mono);
	}

	/* an 18px bar is a hard target for a finger; the hit area grows, the bar does not */
	@media (pointer: coarse) {
		.progress::before {
			content: '';
			position: absolute;
			inset: -13px 0; /* literal ok: 18px bar plus 13px each side is a 44px target */
		}
	}
</style>
