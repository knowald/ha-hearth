<script lang="ts">
	import { ICON } from '../iconSizes';
	import Ripple from '$lib/ui/actions/ripple';
	import { lang } from '$lib/core/i18n';
	import { PRESS_RIPPLE } from '../config';
	import {
		canRedo,
		canUndo,
		editor,
		hearthConfig,
		hasUnsavedEdits,
		redoConfig,
		reloadDiscardingEdits,
		reportCopy,
		requestCancelEdit,
		requestConfirmation,
		saveState,
		saveFailure,
		saveWithFeedback,
		undoConfig
	} from '../store';
	import Icon from '../Icon.svelte';
	import { onMount } from 'svelte';

	// The YAML serializer pulls in js-yaml, which stays out of the eager bundle.
	// Loading starts with the bar so the copy click does not wait on the
	// network, which would cost Safari's user activation for the clipboard.
	const transfer = import('../transfer');

	// the same YAML document the code editor and Versions export
	async function copySessionEdits() {
		const text = (await transfer).configDocument($hearthConfig);
		try {
			if (navigator.clipboard) {
				await navigator.clipboard.writeText(text);
			} else {
				const area = document.createElement('textarea');
				area.value = text;
				area.style.position = 'fixed';
				area.style.opacity = '0';
				document.body.append(area);
				area.select();
				const copied = document.execCommand('copy');
				area.remove();
				if (!copied) throw new Error('copy command was refused');
			}
			reportCopy('copied');
		} catch (error) {
			console.error(error);
			reportCopy('failed');
		}
	}

	function reloadAfterConflict() {
		if (!hasUnsavedEdits()) {
			location.reload();
			return;
		}
		requestConfirmation({
			title: $lang('hearth_reload_discard_title'),
			message: $lang('hearth_reload_discard_message'),
			confirmLabel: $lang('hearth_reload'),
			action: reloadDiscardingEdits
		});
	}

	/*
	 * The bar wraps onto a second row on a phone when the save error and its
	 * actions join it. Its height goes to the shared parent as
	 * --h-edit-bar-height so the toasts above it can follow.
	 */
	let bar = $state<HTMLElement | null>(null);

	$effect(() => {
		const host = bar?.parentElement;
		if (!bar || !host) return;
		const element = bar;
		const measure = () =>
			host.style.setProperty('--h-edit-bar-height', `${element.offsetHeight}px`);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => {
			observer.disconnect();
			host.style.removeProperty('--h-edit-bar-height');
		};
	});

	// hasUnsavedEdits reads stores it does not subscribe to; the draft and the
	// save outcome are what change its answer, so the check reruns on those
	const unsavedId = $props.id();
	let unsaved = $derived.by(() => {
		void $hearthConfig;
		void $saveState;
		return hasUnsavedEdits();
	});

	/*
	 * The first edit session on a browser says how editing works. Seen once
	 * it stays away; a browser that blocks storage just shows it each time.
	 */
	const HINT_SEEN_KEY = 'hearth-edit-hint-seen';
	let showHint = $state(false);

	function hintSeen(): boolean {
		try {
			return localStorage.getItem(HINT_SEEN_KEY) === '1';
		} catch {
			return false;
		}
	}

	function dismissHint() {
		showHint = false;
		try {
			localStorage.setItem(HINT_SEEN_KEY, '1');
		} catch {
			// nothing to remember it in
		}
	}

	// opening any editor is the hint followed, and it would sit over the toasts after
	$effect(() => {
		if ($editor && showHint) dismissHint();
	});

	onMount(() => {
		showHint = !hintSeen();
		// leaving edit mode counts as having seen it
		return () => {
			if (showHint) dismissHint();
		};
	});

	function confirmOverwrite() {
		requestConfirmation({
			title: $lang('hearth_overwrite_newer_hearth_configuration'),
			message: $lang('hearth_this_replaces_the_version_saved_by'),
			confirmLabel: $lang('hearth_overwrite'),
			action: () => void saveWithFeedback(true)
		});
	}
</script>

<div class="edit-bar" bind:this={bar}>
	{#if $saveState === 'conflict'}
		<span class="save-error">{$lang('hearth_config_changed')}</span>
		<button
			type="button"
			class="bar-button pressable"
			use:Ripple={PRESS_RIPPLE}
			onclick={copySessionEdits}
		>
			{$lang('hearth_copy_edits')}
		</button>
		<button
			type="button"
			class="bar-button dangerous pressable"
			use:Ripple={PRESS_RIPPLE}
			onclick={confirmOverwrite}
		>
			{$lang('hearth_overwrite')}
		</button>
		<button
			type="button"
			class="bar-button pressable"
			use:Ripple={PRESS_RIPPLE}
			onclick={reloadAfterConflict}
		>
			{$lang('hearth_reload')}
		</button>
	{:else if $saveState === 'error'}
		<span class="save-error">
			{$lang('hearth_save_failed')}{#if $saveFailure}: {$saveFailure}{/if}
		</span>
	{/if}
	<button
		type="button"
		class="bar-icon pressable"
		aria-label={$lang('settings')}
		onclick={() => editor.set({ kind: 'settings' })}
	>
		<Icon name="settings" size={ICON.control} />
	</button>
	<button
		type="button"
		class="bar-icon pressable"
		aria-label={$lang('theme')}
		onclick={() => editor.set({ kind: 'theme' })}
	>
		<Icon name="palette" size={ICON.control} />
	</button>
	<button
		type="button"
		class="bar-icon"
		disabled={!$canUndo}
		aria-label={$lang('undo')}
		onclick={undoConfig}
	>
		<Icon name="undo" size={ICON.control} />
	</button>
	<button
		type="button"
		class="bar-icon"
		disabled={!$canRedo}
		aria-label={$lang('hearth_redo')}
		onclick={redoConfig}
	>
		<Icon name="redo" size={ICON.control} />
	</button>
	<button
		type="button"
		class="bar-button pressable"
		use:Ripple={PRESS_RIPPLE}
		onclick={requestCancelEdit}>{$lang('cancel')}</button
	>
	<button
		type="button"
		class="bar-button primary pressable"
		use:Ripple={PRESS_RIPPLE}
		aria-describedby={unsaved ? unsavedId : undefined}
		onclick={() => saveWithFeedback()}
	>
		{$lang('save')}
		{#if unsaved}<span class="unsaved-dot" aria-hidden="true"></span>{/if}
	</button>
	<!-- a description rather than part of the name, so Save keeps its name -->
	{#if unsaved}<span class="unsaved-text" id={unsavedId}>{$lang('hearth_unsaved_changes')}</span
		>{/if}
</div>
{#if showHint}
	<div class="edit-hint" role="note">
		<Icon name="touch_app" size={ICON.control} />
		<span>{$lang('hearth_edit_hint')}</span>
		<button
			type="button"
			class="hint-dismiss"
			aria-label={$lang('hearth_dismiss')}
			onclick={dismissHint}
		>
			<Icon name="close" size={ICON.inline} />
		</button>
	</div>
{/if}

<style>
	.edit-bar {
		position: absolute;
		bottom: calc(18px + var(--h-pad-y) + var(--h-safe-bottom));
		left: 50%;
		transform: translateX(-50%);
		z-index: var(--h-layer-toast);
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: var(--h-radius-md);
		background: linear-gradient(180deg, var(--h-sheet-0), var(--h-sheet-1));
		border: 1px solid rgb(var(--h-accent-rgb) / calc(0.18 * var(--h-accent-scale)));
		box-shadow: var(--h-shadow-toast);
	}

	.save-error {
		font-size: var(--h-type-secondary);
		color: var(--h-bad-text);
		padding: 0 8px;
	}

	.bar-icon {
		display: inline-flex;
		color: var(--h-text-3);
		cursor: pointer;
		padding: 4px;
		border: 0;
		background: none;
		font: inherit;
	}

	.bar-icon:disabled {
		color: var(--h-icon-dim);
		cursor: default;
	}

	.bar-button {
		padding: 10px 20px;
		border-radius: var(--h-radius-xs);
		font-size: var(--h-type-body);
		font-weight: 600;
		cursor: pointer;
		color: var(--h-text-3);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		user-select: none;
		-webkit-user-select: none;
		font-family: inherit;
	}

	.bar-button.primary {
		background: linear-gradient(135deg, var(--h-accent-deep), var(--h-accent-bright));
		border: none;
		color: var(--h-on-accent);
	}

	.bar-button.primary {
		position: relative;
	}

	.unsaved-dot {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--h-on-accent);
		border: 2px solid var(--h-accent-deep);
	}

	/* the dot says it to the eye; this says it to assistive technology */
	.unsaved-text {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.edit-hint {
		position: absolute;
		bottom: calc(
			18px + var(--h-pad-y) + var(--h-safe-bottom) + var(--h-edit-bar-height, 60px) + 12px
		); /* literal ok: fallback until the bar is measured */
		left: 50%;
		transform: translateX(-50%);
		z-index: var(--h-layer-toast);
		display: flex;
		align-items: center;
		gap: 10px;
		width: max-content;
		max-width: calc(100 * var(--h-vw) - 32px);
		padding: 10px 10px 10px 16px;
		border-radius: var(--h-radius-md);
		background: linear-gradient(180deg, var(--h-sheet-0), var(--h-sheet-1));
		border: 1px solid rgb(var(--h-accent-rgb) / calc(0.35 * var(--h-accent-scale)));
		box-shadow: var(--h-shadow-toast);
		color: var(--h-text-2);
		font-size: var(--h-type-body);
	}

	.hint-dismiss {
		display: inline-flex;
		padding: 6px;
		border: 0;
		background: none;
		color: var(--h-icon);
		cursor: pointer;
	}

	.bar-button.dangerous {
		color: var(--h-bad-text);
		border-color: rgb(var(--h-bad-rgb) / calc(0.35 * var(--h-accent-scale)));
	}
	/* see breakpoints.ts */
	@media (max-width: 900px) {
		.edit-bar {
			left: calc(8px + var(--h-safe-left));
			right: calc(8px + var(--h-safe-right));
			bottom: calc(8px + var(--h-safe-bottom));
			transform: none;
			gap: 6px;
			padding: 8px;
			flex-wrap: wrap;
			justify-content: flex-end;
		}

		.bar-button {
			padding: 10px 14px;
		}

		.edit-hint {
			bottom: calc(
				8px + var(--h-safe-bottom) + var(--h-edit-bar-height, 60px) + 12px
			); /* literal ok: fallback until the bar is measured */
		}
	}
</style>
