<script lang="ts">
	import { parseYaml } from '../yamlText';
	import { entityIds } from '$lib/core/ha/entities';

	let {
		label,
		value = $bindable(''),
		placeholder = '',
		language = 'yaml',
		expectMapping = language === 'yaml',
		required = false,
		compact = false
	}: {
		label: string;
		value?: string;
		placeholder?: string;
		language?: 'yaml' | 'jinja2' | 'css';
		/** Off for languages a YAML parser would reject, such as a bare template. */
		expectMapping?: boolean;
		/** Marks the label; the editor decides what blocks Done. */
		required?: boolean;
		/** Starts at three lines and grows with the text, for a one-line template in a list row. */
		compact?: boolean;
	} = $props();

	let error = $derived.by(() => {
		if (!expectMapping || !value.trim()) return null;
		const loaded = parseYaml(value);
		if (loaded.issue !== null) return loaded.issue;
		const parsed = loaded.value;
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? null
			: 'Expected a YAML mapping'; // copy ok: yaml diagnostic
	});
</script>

<div class="field code-field" class:compact>
	<span class="field-label" class:field-required={required}>{label}</span>
	<div class="code-workspace">
		{#await import('$lib/ui/CodeEditor.svelte') then CodeEditor}
			<CodeEditor.default
				{value}
				{label}
				{required}
				{placeholder}
				type={language}
				transitionend={false}
				autocompleteList={$entityIds}
				onchange={(next) => (value = next)}
			/>
		{/await}
	</div>
	{#if error}
		<span class="error">{error}</span>
	{/if}
</div>

<style>
	.field {
		display: block;
		margin-bottom: 14px;
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

	.code-workspace {
		min-height: 160px;
	}

	/* three lines of the editor's 1.4 line height, plus its padding and border */
	.compact .code-workspace {
		min-height: calc(4.2 * var(--h-type-emphasis) + 10px);
	}

	.compact .code-workspace :global(.cm-content),
	.compact .code-workspace :global(.cm-gutter) {
		min-height: 4.2em;
	}

	.error {
		display: block;
		margin-top: 6px;
		font-size: var(--h-type-small);
		color: var(--h-bad-text);
	}
</style>
