<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { entityIds } from '$lib/core/ha/entities';
	import { ICON } from '../iconSizes';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from '../config';
	import { downloadText, pickTextFile } from '$lib/ui/download';
	import { editor, hearthConfig, updateConfig, type Editor } from '../store';
	import { configDocument, documentIssue, parseDocument, transferFileName } from '../transfer';
	import EditSheet from './EditSheet.svelte';
	import Icon from '../Icon.svelte';

	/*
	 * Opening Versions swaps the editor target, which unmounts this sheet and
	 * would take an unapplied draft with it - the versions viewer compares
	 * against the saved config, not against the box. The draft rides along in
	 * the editor state instead, so the Back arrow is the only thing that hands
	 * it back and closing the editor drops it.
	 */
	let { draft, from }: { draft?: string; from?: Editor } = $props();

	// snapshot at open time - the editor owns the draft until Apply/discard,
	// it doesn't track further store changes while the sheet is open
	// svelte-ignore state_referenced_locally
	const init = draft ?? configDocument($hearthConfig);
	let value = $state(init);
	let loaded = $state<string | null>(null);
	// pushes an imported document into the mounted CodeMirror view
	let source = $state(init);
	let reloadView = $state(false);

	let error = $derived(documentIssue(value));

	function close() {
		editor.set(null);
	}

	function apply() {
		const normalized = parseDocument(value);
		if (!normalized) return;
		// replace every key in one updateConfig call so undo/redo treats the
		// whole-config edit as a single step
		updateConfig((config) => {
			const draft = config as unknown as Record<string, unknown>;
			for (const key of Object.keys(draft)) delete draft[key];
			Object.assign(draft, normalized);
		});
		editor.set(null);
	}

	function exportDocument() {
		downloadText(transferFileName(new Date()), value);
	}

	async function importDocument() {
		const text = await pickTextFile('.yaml,.yml,text/yaml');
		if (text === undefined) return;
		// the file lands in the editor rather than in the dashboard: the same
		// validation runs on it, and Apply is still the step that replaces a layout
		value = text;
		source = text;
		reloadView = true;
		loaded = $lang('hearth_import_file_loaded_apply');
	}
</script>

<EditSheet
	title={$lang('hearth_configuration_yaml')}
	onclose={close}
	onback={from ? () => editor.set(from) : undefined}
	ondone={apply}
	doneLabel={$lang('hearth_apply')}
	doneDisabled={!!error}
>
	<div class="field-hint">
		{$lang('hearth_edits_the_whole_configuration_applies_as')}
	</div>
	<div class="toolbar">
		<button type="button" class="tool pressable" use:Ripple={PRESS_RIPPLE} onclick={importDocument}>
			<Icon name="upload_file" size={ICON.inline} />
			{$lang('hearth_import_file')}
		</button>
		<button type="button" class="tool pressable" use:Ripple={PRESS_RIPPLE} onclick={exportDocument}>
			<Icon name="download" size={ICON.inline} />
			{$lang('hearth_export_file')}
		</button>
		<button
			type="button"
			class="tool pressable"
			use:Ripple={PRESS_RIPPLE}
			onclick={() => editor.set({ kind: 'versions', from: { kind: 'code', draft: value, from } })}
		>
			<Icon name="history" size={ICON.inline} />
			{$lang('hearth_versions')}
		</button>
	</div>
	<div class="code-workspace">
		{#await import('$lib/ui/CodeEditor.svelte') then CodeEditor}
			<CodeEditor.default
				{value}
				init={source}
				bind:reloadView
				type="yaml"
				transitionend={true}
				autocompleteList={$entityIds}
				onchange={(next) => {
					value = next;
					if (next !== source) loaded = null;
				}}
				onsave={apply}
			/>
		{/await}
	</div>
	{#if error}
		<div class="error" role="alert">{error}</div>
	{:else if loaded}
		<div class="loaded">{loaded}</div>
	{/if}
</EditSheet>

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 10px;
	}

	.tool {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		border-radius: var(--h-radius-xs);
		font-family: inherit;
		font-size: var(--h-type-secondary);
		color: var(--h-text-3);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		cursor: pointer;
	}

	.error {
		font-size: var(--h-type-small);
		color: var(--h-bad-text);
		margin-top: 10px;
	}

	.loaded {
		font-size: var(--h-type-small);
		color: var(--h-text-6);
		margin-top: 10px;
	}

	.code-workspace {
		min-height: 480px;
	}
</style>
