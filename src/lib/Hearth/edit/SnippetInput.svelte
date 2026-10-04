<script lang="ts">
	import type { Snippet } from 'svelte';
	import { lang } from '$lib/core/i18n';
	import Ripple from '$lib/ui/actions/ripple';
	import { readClipboard } from '$lib/ui/clipboard';
	import { pickTextFile } from '$lib/ui/download';
	import { PRESS_RIPPLE } from '../config';
	import { ICON } from '../iconSizes';
	import Icon from '../Icon.svelte';
	import '../buttons.css';

	/**
	 * A box to paste YAML into: Paste YAML in the type gallery and the theme
	 * import. The clipboard button fills the box where the browser allows it;
	 * over plain http it does not, and pasting by hand still works. Either way
	 * the text is checked as it arrives and only added on the submit button.
	 */
	let {
		label,
		hint,
		submitLabel,
		accept,
		check,
		preview,
		onsubmit,
		oncancel
	}: {
		label: string;
		hint: string;
		submitLabel: string;
		/** File types for a Choose file button; none without it. */
		accept?: string;
		/** Why the text cannot be used yet, checked as it is typed; null when it can. */
		check?: (text: string) => string | null;
		/** Shown under the box while the text checks out. */
		preview?: Snippet<[string]>;
		/** Uses the text, or returns why it cannot. */
		onsubmit: (text: string) => string | null;
		oncancel: () => void;
	} = $props();

	let text = $state('');
	let submitted = $state<string | null>(null);
	let canReadClipboard = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;

	let live = $derived(text.trim() && check ? check(text) : null);
	let issue = $derived(submitted ?? live);

	function submit() {
		submitted = onsubmit(text);
	}

	async function fromClipboard() {
		const pasted = await readClipboard();
		if (pasted === undefined) {
			submitted = $lang('hearth_clipboard_unreadable');
			return;
		}
		text = pasted;
		submitted = null;
	}

	async function fromFile() {
		const loaded = await pickTextFile(accept ?? '');
		if (loaded === undefined) return;
		text = loaded;
		submitted = null;
	}
</script>

<div class="snippet-input">
	<label class="box">
		<span class="field-label">{label}</span>
		<textarea rows="8" spellcheck="false" bind:value={text} oninput={() => (submitted = null)}
		></textarea>
	</label>
	<div class="field-hint">{hint}</div>
	<!-- always present, so a screen reader announces each new issue -->
	<div class="issue" aria-live="polite">{issue ?? ''}</div>
	{#if !issue && text.trim() && preview}
		{@render preview(text)}
	{/if}
	<div class="actions">
		{#if canReadClipboard}
			<button
				type="button"
				class="hearth-button secondary pressable"
				use:Ripple={PRESS_RIPPLE}
				onclick={fromClipboard}
			>
				<Icon name="content_paste" size={ICON.inline} />
				{$lang('hearth_paste_from_clipboard')}
			</button>
		{/if}
		{#if accept !== undefined}
			<button
				type="button"
				class="hearth-button secondary pressable"
				use:Ripple={PRESS_RIPPLE}
				onclick={fromFile}
			>
				<Icon name="upload_file" size={ICON.inline} />
				{$lang('hearth_choose_file')}
			</button>
		{/if}
		<span class="grow"></span>
		<button
			type="button"
			class="hearth-button secondary pressable"
			use:Ripple={PRESS_RIPPLE}
			onclick={oncancel}
		>
			{$lang('cancel')}
		</button>
		<button
			type="button"
			class="hearth-button primary pressable"
			disabled={!text.trim() || !!live}
			use:Ripple={PRESS_RIPPLE}
			onclick={submit}
		>
			{submitLabel}
		</button>
	</div>
</div>

<style>
	.snippet-input {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 18px;
	}

	.box {
		display: block;
	}

	.field-label {
		display: block;
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-label);
		margin-bottom: 6px;
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

	/* iOS Safari zooms the page into any input set under 16px */
	@media (pointer: coarse) {
		textarea {
			font-size: max(var(--h-input-floor), var(--h-type-small));
		}
	}

	.issue {
		font-size: var(--h-type-small);
		color: var(--h-bad-text);
	}

	.issue:not(:empty) {
		margin-bottom: 8px;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.actions .hearth-button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.grow {
		flex: 1;
	}
</style>
