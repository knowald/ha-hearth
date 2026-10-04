<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from '../config';

	/**
	 * Form or YAML for one card or widget. Leaving YAML re-reads it into the
	 * form, so while it does not parse the way back is closed.
	 */
	let {
		mode,
		formBlocked,
		onform,
		onyaml
	}: {
		mode: 'form' | 'yaml';
		/** Why the YAML cannot go back into the form, or null when it can. */
		formBlocked: string | null;
		onform: () => void;
		onyaml: () => void;
	} = $props();

	let blocked = $derived(mode === 'yaml' && formBlocked !== null);
</script>

<div class="modes" role="group" aria-label={$lang('hearth_editor_view')}>
	<button
		type="button"
		class="mode pressable"
		class:active={mode === 'form'}
		aria-pressed={mode === 'form'}
		disabled={blocked}
		title={blocked ? $lang('hearth_fix_the_yaml_to_use_the_form') : undefined}
		use:Ripple={PRESS_RIPPLE}
		onclick={() => mode !== 'form' && onform()}
	>
		{$lang('hearth_form')}
	</button>
	<button
		type="button"
		class="mode pressable"
		class:active={mode === 'yaml'}
		aria-pressed={mode === 'yaml'}
		use:Ripple={PRESS_RIPPLE}
		onclick={() => mode !== 'yaml' && onyaml()}
	>
		{$lang('hearth_yaml')}
	</button>
</div>

<style>
	.modes {
		display: flex;
		width: fit-content;
		gap: 2px;
		padding: 2px;
		margin-bottom: 14px;
		border-radius: var(--h-radius-xs);
		background: rgb(var(--h-surface-rgb) / calc(0.05 * var(--h-fill-scale)));
	}

	.mode {
		padding: 6px 16px;
		border: 0;
		border-radius: var(--h-radius-tight);
		background: none;
		font-family: inherit;
		font-size: var(--h-type-secondary);
		color: var(--h-text-4);
		cursor: pointer;
	}

	.mode.active {
		background: rgb(var(--h-accent-rgb) / calc(0.16 * var(--h-accent-scale)));
		color: var(--h-accent-text);
	}

	.mode:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
