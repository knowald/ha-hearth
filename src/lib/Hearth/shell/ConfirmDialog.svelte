<script lang="ts">
	import { ICON } from '../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { confirmRequestedAction, dismissConfirmation, requestedConfirmation } from '../store';
	import Icon from '../Icon.svelte';
	import { layer } from '$lib/ui/layers';
	import '../buttons.css';
</script>

{#if $requestedConfirmation}
	<div
		class="confirm-backdrop"
		role="presentation"
		onclick={(event) => event.target === event.currentTarget && dismissConfirmation()}
	>
		<div
			class="confirm-dialog"
			role="alertdialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="hearth-confirm-title"
			use:layer={{ close: dismissConfirmation, trap: true, initialFocus: true }}
		>
			<Icon name="warning" size={ICON.tile} color="var(--h-bad-text)" />
			<div class="confirm-copy">
				<strong id="hearth-confirm-title">{$requestedConfirmation.title}</strong>
				<span>{$requestedConfirmation.message}</span>
			</div>
			<!-- cancel comes first, so the safe action is the one that takes focus -->
			<div class="confirm-actions">
				<button type="button" class="hearth-button secondary" onclick={dismissConfirmation}>
					{$lang('cancel')}
				</button>
				<button type="button" class="hearth-button danger" onclick={confirmRequestedAction}>
					{$requestedConfirmation.confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.confirm-backdrop {
		position: absolute;
		inset: 0;
		z-index: var(--h-layer-confirm);
		display: grid;
		place-items: center;
		padding: 20px;
		background: var(--h-scrim);
		backdrop-filter: blur(8px);
	}

	.confirm-dialog {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 14px;
		width: min(430px, 100%);
		padding: var(--h-modal-padding);
		border-radius: var(--h-radius-xl);
		background: linear-gradient(180deg, var(--h-sheet-0), var(--h-sheet-1));
		border: 1px solid rgb(var(--h-bad-rgb) / calc(0.48 * var(--h-accent-scale)));
		box-shadow: var(--h-shadow-layer);
	}

	.confirm-copy {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.confirm-copy strong {
		font-size: var(--h-type-subtitle);
		color: var(--h-text-1);
	}

	.confirm-copy span {
		font-size: var(--h-type-body);
		color: var(--h-text-4);
	}

	.confirm-actions {
		grid-column: 1 / -1;
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 6px;
	}
</style>
