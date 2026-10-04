<script lang="ts">
	import { ICON } from '../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { vibrate } from '$lib/core/app/haptics';
	import { editLockOf, railPositionOf } from '../config';
	import {
		enterEditMode,
		fetchServerRevision,
		hearthConfig,
		hearthEditMode,
		hearthLoadError,
		hearthRevision,
		requestConfirmation
	} from '../store';
	import { HOLD_MS, screenSheetOpen } from '../screen';
	import Icon from '../Icon.svelte';

	// the toggle sits at the rail's foot, so a lone right rail takes it along
	let toggleRight = $derived(railPositionOf($hearthConfig) === 'right');
	// edit_lock stops a stray tap on a wall tablet, not a person who means it
	let lock = $derived(editLockOf($hearthConfig));

	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	let holding = $state(false);
	let hintTimer: ReturnType<typeof setTimeout> | undefined;
	let hint = $state(false);
	let pinOpen = $state(false);
	let checkingRevision = $state(false);

	/*
	 * A wall tablet can keep a page open for weeks, and editing a revision that
	 * another screen has since replaced only ends in a conflict on save. Offer
	 * the newer one first; when the server cannot say, editing goes ahead.
	 * Runs once the lock, if any, has been passed.
	 */
	async function startEditing() {
		if (checkingRevision) return;
		checkingRevision = true;
		const revision = await fetchServerRevision();
		checkingRevision = false;
		// the import wizard may have handed a failed save to edit mode meanwhile
		if ($hearthEditMode) return;
		if (revision === undefined || revision <= $hearthRevision) {
			enterEditMode();
			return;
		}
		requestConfirmation({
			title: $lang('hearth_newer_config_title'),
			message: $lang('hearth_newer_config_message'),
			confirmLabel: $lang('hearth_reload'),
			action: () => location.reload(),
			cancelLabel: $lang('hearth_edit_anyway'),
			cancel: () => enterEditMode()
		});
	}

	function startHold() {
		if (lock !== 'hold' || holding || checkingRevision) return;
		holding = true;
		holdTimer = setTimeout(() => {
			holding = false;
			vibrate('commit');
			startEditing();
		}, HOLD_MS);
	}

	// let go early: say what the toggle wants instead of doing nothing silently
	function endHold() {
		if (!holding) return;
		clearTimeout(holdTimer);
		holding = false;
		hint = true;
		clearTimeout(hintTimer);
		hintTimer = setTimeout(() => (hint = false), 2500);
	}

	function handleClick() {
		if (lock === 'off') startEditing();
		else if (lock === 'pin') pinOpen = true;
	}

	function loadPinPrompt() {
		return import('./PinPrompt.svelte').catch((error) => {
			console.warn('PIN prompt unavailable', error);
			pinOpen = false;
			throw error;
		});
	}

	function isActivation(event: KeyboardEvent) {
		return event.key === 'Enter' || event.key === ' ';
	}

	$effect(() => () => {
		clearTimeout(holdTimer);
		clearTimeout(hintTimer);
	});
</script>

<div class="edit-entry" class:right={toggleRight}>
	{#if !$hearthLoadError}
		<button
			type="button"
			class="edit-toggle pressable"
			class:held={lock === 'hold'}
			class:holding
			class:busy={checkingRevision}
			aria-busy={checkingRevision}
			aria-label={$lang('hearth_edit_configuration')}
			onclick={handleClick}
			onpointerdown={(event) => event.button === 0 && startHold()}
			onpointerup={endHold}
			onpointerleave={endHold}
			onpointercancel={endHold}
			oncontextmenu={(event) => lock === 'hold' && event.preventDefault()}
			onkeydown={(event) => isActivation(event) && !event.repeat && startHold()}
			onkeyup={(event) => isActivation(event) && endHold()}
		>
			<Icon name="edit" size={ICON.control} />
			<span>{$lang(hint ? 'hearth_hold_to_edit' : 'hearth_edit_configuration')}</span>
		</button>
	{/if}
	<button
		type="button"
		class="screen-toggle pressable"
		aria-label={$lang('hearth_this_screen')}
		title={$lang('hearth_this_screen')}
		onclick={() => screenSheetOpen.set(true)}
	>
		<Icon name="display_settings" size={ICON.control} />
	</button>
</div>

{#if pinOpen}
	<!-- only a PIN-locked dashboard pays for the prompt -->
	{#await loadPinPrompt() then PinPrompt}
		<PinPrompt.default
			pin={$hearthConfig.edit_pin ?? ''}
			onunlock={() => {
				pinOpen = false;
				startEditing();
			}}
			onclose={() => (pinOpen = false)}
		/>
	{:catch}
		<!-- offline or a stale deploy: closed, so the next tap tries again -->
	{/await}
{/if}

<style>
	/* a labeled row at the rail's foot rather than an anonymous floating pencil */
	.edit-entry {
		position: absolute;
		/* the insets clear an installed app's home indicator and a landscape cutout */
		left: calc(14px + var(--h-pad-x) + var(--h-safe-left));
		bottom: calc(14px + var(--h-pad-y) + var(--h-safe-bottom));
		z-index: var(--h-layer-bar);
		display: flex;
		align-items: center;
		gap: 6px;
	}

	/* see breakpoints.ts: folded, there is no rail column to follow */
	@media (min-width: 901px) {
		.edit-entry.right {
			left: auto;
			right: calc(14px + var(--h-pad-x) + var(--h-safe-right));
			flex-direction: row-reverse;
		}
	}

	.edit-toggle,
	.screen-toggle {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		border-radius: var(--h-radius-sm);
		color: var(--h-text-4);
		font-size: var(--h-type-body);
		cursor: pointer;
		opacity: 0.75;
		border: 0;
		background: rgb(var(--h-surface-rgb) / calc(0.035 * var(--h-fill-scale)));
		font-family: inherit;
		overflow: hidden;
		-webkit-touch-callout: none;
	}

	.screen-toggle {
		padding: 12px;
	}

	/* a finger held still must not turn into a scroll or a text selection,
	   either of which cancels the hold */
	.edit-toggle.held {
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	/* waiting on the revision check; further taps are ignored */
	.edit-toggle.busy,
	.edit-toggle.busy:hover {
		cursor: progress;
		opacity: 0.45;
	}

	/* fills along the foot while a locked toggle is held */
	.edit-toggle::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 2px;
		background: var(--h-accent-text);
		transform: scaleX(0);
		transform-origin: left;
	}

	.edit-toggle.holding::after {
		transform: scaleX(1);
		transition: transform 2s linear; /* literal ok: matches HOLD_MS in screen.ts */
	}

	@media (hover: hover) {
		.edit-toggle:hover,
		.screen-toggle:hover {
			opacity: 1;
			color: var(--h-text-3);
			background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		}
	}
</style>
