<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { vibrate } from '$lib/core/app/haptics';
	import { layer } from '$lib/ui/layers';
	import '../buttons.css';

	/*
	 * Asks for the dashboard's edit PIN. The PIN ships with the dashboard, so
	 * this only stops a stray tap from opening the editor; it guards nothing.
	 */
	let { pin, onunlock, onclose }: { pin: string; onunlock: () => void; onclose: () => void } =
		$props();

	let value = $state('');
	let wrong = $state(false);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (value === pin) {
			onunlock();
			return;
		}
		wrong = true;
		value = '';
		vibrate('error');
	}
</script>

<div
	class="pin-backdrop"
	role="presentation"
	onclick={(event) => event.target === event.currentTarget && onclose()}
>
	<div
		class="pin-dialog"
		role="dialog"
		aria-modal="true"
		aria-labelledby="hearth-pin-title"
		use:layer={{ close: onclose, trap: true, initialFocus: true }}
	>
		<form onsubmit={submit}>
			<strong id="hearth-pin-title">{$lang('hearth_enter_edit_pin')}</strong>
			<span class="pin-note">{$lang('hearth_edit_pin_note')}</span>
			<input
				type="password"
				inputmode="numeric"
				autocomplete="off"
				maxlength="8"
				aria-label={$lang('hearth_edit_pin')}
				aria-invalid={wrong || undefined}
				bind:value
				oninput={() => (wrong = false)}
			/>
			{#if wrong}
				<span class="pin-error" role="alert">{$lang('hearth_wrong_pin')}</span>
			{/if}
			<div class="pin-actions">
				<button type="button" class="hearth-button secondary" onclick={onclose}>
					{$lang('cancel')}
				</button>
				<button type="submit" class="hearth-button primary">{$lang('hearth_unlock')}</button>
			</div>
		</form>
	</div>
</div>

<style>
	.pin-backdrop {
		position: absolute;
		inset: 0;
		z-index: var(--h-layer-confirm);
		display: grid;
		place-items: center;
		padding: 20px;
		background: var(--h-scrim);
		backdrop-filter: blur(8px);
	}

	.pin-dialog {
		width: min(360px, 100%);
		padding: var(--h-modal-padding);
		border-radius: var(--h-radius-xl);
		background: linear-gradient(180deg, var(--h-sheet-0), var(--h-sheet-1));
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		box-shadow: var(--h-shadow-layer);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	strong {
		font-size: var(--h-type-subtitle);
		color: var(--h-text-1);
	}

	.pin-note {
		font-size: var(--h-type-small);
		color: var(--h-text-6);
	}

	input {
		padding: 12px 14px;
		border-radius: var(--h-radius-xs);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		background: var(--h-track);
		color: var(--h-text-2);
		font-family: var(--h-font-mono);
		font-size: var(--h-type-title);
		letter-spacing: 4px;
		text-align: center;
	}

	.pin-error {
		font-size: var(--h-type-small);
		color: var(--h-bad-text);
	}

	.pin-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 6px;
	}
</style>
