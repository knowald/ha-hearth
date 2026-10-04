<script lang="ts">
	import { ICON } from '../iconSizes';
	import Ripple from '$lib/ui/actions/ripple';
	import { lang } from '$lib/core/i18n';
	import { PRESS_RIPPLE } from '../config';
	import {
		cancelEdit,
		canRedo,
		canUndo,
		editor,
		hearthConfig,
		hasUnsavedEdits,
		redoConfig,
		reloadDiscardingEdits,
		reportCopy,
		requestConfirmation,
		saveState,
		saveFailure,
		saveWithFeedback,
		undoConfig
	} from '../store';
	import Icon from '../Icon.svelte';

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

	function cancel() {
		if (!hasUnsavedEdits()) {
			cancelEdit();
			return;
		}
		requestConfirmation({
			title: $lang('hearth_discard_edits_title'),
			message: $lang('hearth_discard_edits_message'),
			confirmLabel: $lang('hearth_discard'),
			action: cancelEdit
		});
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
	<button type="button" class="bar-button pressable" use:Ripple={PRESS_RIPPLE} onclick={cancel}
		>{$lang('cancel')}</button
	>
	<button
		type="button"
		class="bar-button primary pressable"
		use:Ripple={PRESS_RIPPLE}
		onclick={() => saveWithFeedback()}>{$lang('save')}</button
	>
</div>

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
	}
</style>
