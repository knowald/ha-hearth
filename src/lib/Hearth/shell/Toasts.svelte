<script lang="ts">
	import { ICON } from '../iconSizes';
	import { fade } from 'svelte/transition';
	import { motion } from '$lib/core/app/motion';
	import { health } from '$lib/core/ha/connection';
	import { commandFailure, dismissCommandFailure } from '$lib/core/ha/commands';
	import { lang } from '$lib/core/i18n';
	import {
		configurationLoadError,
		hearthEditMode,
		hearthLoadError,
		hearthLoadErrorKind,
		saveState,
		type HearthErrorKind
	} from '../store';
	import Icon from '../Icon.svelte';

	/** How far the current fill-screen page overflows while editing, in px. */
	let { overflowBy = 0 }: { overflowBy?: number } = $props();

	type ConnectionIssue = 'lost' | 'degraded';

	// 'booting' is covered by the boot splash; 'degraded' keeps the socket
	// open with some subscription stale, which is not a lost connection
	let connectionIssue = $derived<ConnectionIssue | null>(
		$health === 'lost' || $health === 'degraded' ? $health : null
	);

	// only surface a connection issue once it has lasted 2s, so brief
	// websocket blips (reload, sleep/wake) don't flash the banner
	let shownIssue = $state<ConnectionIssue | null>(null);

	$effect(() => {
		const issue = connectionIssue;
		if (!issue) {
			shownIssue = null;
			return;
		}
		const timer = setTimeout(() => (shownIssue = issue), 2000);
		return () => clearTimeout(timer);
	});

	const hearthErrorCopy: Record<HearthErrorKind, [string, string]> = {
		unreadable: ['hearth_config_unreadable', 'hearth_config_unreadable_hint'],
		version: ['hearth_config_version_unsupported', 'hearth_config_version_hint'],
		invalid: ['hearth_config_invalid', 'hearth_config_invalid_hint']
	};
	let hearthErrorTitle = $derived(hearthErrorCopy[$hearthLoadErrorKind ?? 'invalid']);
</script>

{#if shownIssue}
	<div
		class="connection-toast"
		class:degraded={shownIssue === 'degraded'}
		role="status"
		transition:fade={{ duration: $motion ? 250 : 0 }}
	>
		<Icon name={shownIssue === 'lost' ? 'cloud_off' : 'sync_problem'} size={ICON.control} />
		{$lang(shownIssue === 'lost' ? 'hearth_connection_lost' : 'hearth_connection_degraded')}
	</div>
{/if}
{#if $hearthLoadError || $configurationLoadError}
	<div class="load-errors">
		{#if $configurationLoadError}
			<div class="load-error" role="alert">
				<Icon name="error" size={ICON.control} />
				<div class="load-error-copy">
					<strong>{$lang('hearth_settings_file_unreadable')}</strong>
					<span>{$lang('hearth_settings_file_unreadable_hint')}</span>
					<span class="detail">{$configurationLoadError}</span>
				</div>
				<button type="button" class="load-error-action" onclick={() => location.reload()}>
					{$lang('hearth_reload')}
				</button>
			</div>
		{/if}
		{#if $hearthLoadError}
			<div class="load-error" role="alert">
				<Icon name="error" size={ICON.control} />
				<div class="load-error-copy">
					<strong>{$lang(hearthErrorTitle[0])}</strong>
					<span>{$lang(hearthErrorTitle[1])}</span>
					<span>{$lang('hearth_editing_is_disabled_to_protect_the')}</span>
					<span class="detail">{$hearthLoadError}</span>
				</div>
				<button type="button" class="load-error-action" onclick={() => location.reload()}>
					{$lang('hearth_reload')}
				</button>
			</div>
		{/if}
	</div>
{/if}
{#if $saveState === 'saved'}
	<div class="save-toast" transition:fade={{ duration: $motion ? 250 : 0 }}>
		<Icon name="check_circle" size={ICON.control} />
		{$lang('saved')}
	</div>
{/if}
{#if $commandFailure}
	<div
		class="command-error"
		class:editing={$hearthEditMode}
		role="alert"
		transition:fade={{ duration: $motion ? 250 : 0 }}
	>
		<Icon name="error" size={ICON.control} />
		<div>
			<strong>{$lang('hearth_command_failed')}</strong>
			<span>
				{#if $commandFailure.entityId}{$commandFailure.entityId}:
				{/if}{$commandFailure.detail}
			</span>
		</div>
		<button
			type="button"
			class="toast-dismiss"
			aria-label={$lang('hearth_close')}
			onclick={dismissCommandFailure}
		>
			<Icon name="close" size={ICON.control} />
		</button>
	</div>
{/if}
{#if overflowBy > 0}
	<div class="overflow-toast" transition:fade={{ duration: $motion ? 250 : 0 }}>
		<Icon name="unfold_less" size={ICON.control} />
		{$lang('hearth_page_overflows_this_screen_by')}
		{overflowBy}px
	</div>
{/if}

<style>
	.connection-toast {
		position: absolute;
		top: calc(18px + var(--h-pad-y));
		left: 50%;
		transform: translateX(-50%);
		z-index: var(--h-layer-alert);
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border-radius: var(--h-radius-md);
		background: linear-gradient(180deg, var(--h-sheet-0), var(--h-sheet-1));
		border: 1px solid rgb(var(--h-accent-rgb) / calc(0.18 * var(--h-accent-scale)));
		color: var(--h-bad-text);
		font-size: var(--h-type-body);
		font-weight: 600;
		box-shadow: 0 20px 60px var(--h-scrim);
	}

	.connection-toast.degraded {
		color: var(--h-text-3);
		font-weight: 500;
	}

	.load-errors {
		position: absolute;
		top: calc(18px + var(--h-pad-y));
		left: 50%;
		transform: translateX(-50%);
		z-index: calc(var(--h-layer-toast) + 2);
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: min(620px, calc(100vw - 32px));
	}

	.load-error {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 14px 16px;
		border-radius: var(--h-radius-md);
		background: linear-gradient(180deg, var(--h-sheet-0), var(--h-sheet-1));
		border: 1px solid rgb(var(--h-bad-rgb) / 0.5);
		color: var(--h-bad-text);
		box-shadow: 0 20px 60px var(--h-scrim);
	}

	.load-error-copy {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.load-error strong {
		font-size: var(--h-type-body);
	}

	.load-error span {
		font-size: var(--h-type-small);
		overflow-wrap: anywhere;
	}

	.load-error .detail {
		margin-top: 4px;
		font-family: var(--h-font-mono);
		color: var(--h-text-5);
	}

	.load-error-action {
		flex: none;
		padding: 8px 14px;
		border-radius: var(--h-radius-xs);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		color: var(--h-text-2);
		font-family: inherit;
		font-size: var(--h-type-secondary);
		font-weight: 600;
		cursor: pointer;
	}

	.save-toast {
		position: absolute;
		bottom: calc(40px + var(--h-pad-y));
		left: 50%;
		transform: translateX(-50%);
		z-index: var(--h-layer-toast);
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border-radius: var(--h-radius-md);
		background: linear-gradient(180deg, var(--h-sheet-0), var(--h-sheet-1));
		border: 1px solid rgb(var(--h-accent-rgb) / calc(0.18 * var(--h-accent-scale)));
		color: var(--h-good-text);
		font-size: var(--h-type-body);
		font-weight: 600;
		box-shadow: 0 20px 60px var(--h-scrim);
	}

	.command-error {
		position: absolute;
		bottom: calc(40px + var(--h-pad-y));
		left: 50%;
		transform: translateX(-50%);
		z-index: var(--h-layer-alert);
		display: flex;
		align-items: flex-start;
		gap: 10px;
		width: min(560px, calc(100vw - 32px));
		padding: 12px 12px;
		border-radius: var(--h-radius-md);
		background: linear-gradient(180deg, var(--h-sheet-0), var(--h-sheet-1));
		border: 1px solid rgb(var(--h-bad-rgb) / 0.55);
		color: var(--h-bad-text);
		box-shadow: 0 20px 60px var(--h-scrim);
	}

	.command-error > div {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		gap: 2px;
	}

	.command-error strong {
		font-size: var(--h-type-body);
	}

	.command-error span {
		font-size: var(--h-type-small);
		overflow-wrap: anywhere;
	}

	.toast-dismiss {
		display: inline-flex;
		padding: 4px;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
	}

	.overflow-toast {
		position: absolute;
		top: calc(18px + var(--h-pad-y));
		left: 50%;
		transform: translateX(-50%);
		z-index: var(--h-layer-toast);
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border-radius: var(--h-radius-md);
		background: linear-gradient(180deg, var(--h-sheet-0), var(--h-sheet-1));
		border: 1px solid rgb(var(--h-accent-rgb) / calc(0.18 * var(--h-accent-scale)));
		color: var(--h-accent-text);
		font-size: var(--h-type-body);
		font-weight: 600;
		box-shadow: 0 20px 60px var(--h-scrim);
	}
	/* the edit bar sits along the bottom while editing; the toast moves above it */
	.command-error.editing {
		/* the same room the layout leaves for the edit bar */
		bottom: calc(
			112px + var(--h-pad-y) + env(safe-area-inset-bottom)
		); /* literal ok: edit bar height plus margin */
	}
</style>
