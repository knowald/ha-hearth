<script lang="ts">
	import type { Snippet } from 'svelte';
	import { get } from 'svelte/store';
	import { EDIT_SETTLE_MS, watchTemplateLazily } from './lazyTemplates';
	import { hearthEditMode } from './store';

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

	function follower(set: (text: string | undefined) => void) {
		// only a template edited after the first render waits for typing to pause
		let shown = false;
		return (template: string | undefined) => {
			set(undefined);
			if (!template) return;
			const delay = shown && get(hearthEditMode) ? EDIT_SETTLE_MS : 0;
			shown = true;
			return watchTemplateLazily(
				template,
				(render) => set(render.status === 'ready' ? render.result.trim() || undefined : undefined),
				delay
			);
		};
	}

	const followName = follower((text) => (name = text));
	const followState = follower((text) => (stateText = text));

	$effect(() => followName(nameTemplate));
	$effect(() => followState(stateTemplate));
</script>

{@render children(name, stateText)}
