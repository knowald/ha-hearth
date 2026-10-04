<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { requestCancelEdit } from '../store';

	/** Stands in for the edit bar when edit mode's code failed to load. */
	let { onretry }: { onretry: () => void } = $props();
</script>

<div class="edit-load-error" role="alert">
	<span>{$lang('hearth_could_not_load_component')}</span>
	<button type="button" class="bar-button" onclick={onretry}>{$lang('hearth_retry')}</button>
	<!-- the bar's own Cancel, so unsaved edits still ask first -->
	<button type="button" class="bar-button" onclick={requestCancelEdit}>
		{$lang('hearth_exit_edit_mode')}
	</button>
</div>

<style>
	.edit-load-error {
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
		border: 1px solid rgb(var(--h-bad-rgb) / calc(0.35 * var(--h-accent-scale)));
		box-shadow: var(--h-shadow-toast);
		font-size: var(--h-type-secondary);
		color: var(--h-bad-text);
	}

	.bar-button {
		padding: 10px 16px;
		border-radius: var(--h-radius-xs);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		color: var(--h-text-3);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
	}

	/* see breakpoints.ts */
	@media (max-width: 900px) {
		.edit-load-error {
			left: calc(8px + var(--h-safe-left));
			right: calc(8px + var(--h-safe-right));
			bottom: calc(8px + var(--h-safe-bottom));
			transform: none;
			flex-wrap: wrap;
			justify-content: flex-end;
		}
	}
</style>
