<script lang="ts">
	import type { Snippet } from 'svelte';
	import { watchTemplateLazily } from './lazyTemplates';

	/*
	 * Renders an entity ref's name_template and state_template for its tile.
	 * Each is undefined until Home Assistant renders it, and again when it fails
	 * or renders blank, so the tile shows its normal text instead.
	 */
	let {
		nameTemplate = undefined,
		stateTemplate = undefined,
		children
	}: {
		nameTemplate?: string;
		stateTemplate?: string;
		children: Snippet<[name: string | undefined, state: string | undefined]>;
	} = $props();

	let name = $state<string>();
	let stateText = $state<string>();

	function follow(template: string | undefined, set: (text: string | undefined) => void) {
		set(undefined);
		if (!template) return;
		return watchTemplateLazily(template, (render) =>
			set(render.status === 'ready' ? render.result.trim() || undefined : undefined)
		);
	}

	$effect(() => follow(nameTemplate, (text) => (name = text)));
	$effect(() => follow(stateTemplate, (text) => (stateText = text)));
</script>

{@render children(name, stateText)}
