<script lang="ts">
	import * as yaml from 'js-yaml';
	import { entityIds } from '$lib/core/ha/entities';

	let {
		label,
		value = $bindable(''),
		placeholder = '',
		language = 'yaml',
		expectMapping = language === 'yaml'
	}: {
		label: string;
		value?: string;
		placeholder?: string;
		language?: 'yaml' | 'jinja2' | 'css';
		/** Off for languages a YAML parser would reject, such as a bare template. */
		expectMapping?: boolean;
	} = $props();

	let error = $derived.by(() => {
		if (!expectMapping || !value.trim()) return null;
		try {
			const parsed = yaml.load(value);
			return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
				? null
				: 'Expected a YAML mapping'; // copy ok: yaml diagnostic
		} catch (parseError) {
			return parseError instanceof Error ? parseError.message.split('\n')[0] : 'Invalid YAML'; // copy ok: yaml diagnostic
		}
	});
</script>

<div class="field code-field">
	<span class="field-label">{label}</span>
	<div class="code-workspace">
		{#await import('$lib/ui/CodeEditor.svelte') then CodeEditor}
			<CodeEditor.default
				{value}
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

	.error {
		display: block;
		margin-top: 6px;
		font-size: var(--h-type-small);
		color: var(--h-bad-text);
	}
</style>
