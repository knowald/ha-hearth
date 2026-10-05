<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from '../config';
	import '../buttons.css';

	/** The copied text, selected for copying by hand where the clipboard was out of reach. */
	let { text, onclose }: { text: string; onclose: () => void } = $props();

	function selectAll(node: HTMLTextAreaElement) {
		node.focus();
		node.select();
	}
</script>

<div class="copy-fallback">
	<div class="field-hint">{$lang('hearth_copy_by_hand')}</div>
	<textarea
		readonly
		rows="8"
		spellcheck="false"
		aria-label={$lang('hearth_yaml_to_copy')}
		value={text}
		use:selectAll
		onfocus={(event) => event.currentTarget.select()}></textarea>
	<button
		type="button"
		class="hearth-button secondary pressable"
		use:Ripple={PRESS_RIPPLE}
		onclick={onclose}
	>
		{$lang('hearth_close')}
	</button>
</div>

<style>
	.copy-fallback {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		margin-bottom: 18px;
	}

	textarea {
		box-sizing: border-box;
		width: 100%;
		padding: 10px 12px;
		border-radius: var(--h-radius-xs);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		background: var(--h-track);
		color: var(--h-text-2);
		font-family: var(--h-font-mono);
		font-size: var(--h-type-small);
		resize: vertical;
	}
</style>
