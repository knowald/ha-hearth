<script lang="ts">
	import { ICON } from '../../iconSizes';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from '../../config';
	import { hearthConfig, hearthEditMode } from '../../store';
	import { playSpotifyUri, type MediaShortcut } from '../../media';
	import Icon from '../../Icon.svelte';
	import ScrollEdge from '$lib/ui/ScrollEdge.svelte';
	import { scrollEdges, type ScrollEdges } from '$lib/ui/actions/scrollEdges';

	let {
		entity,
		shortcuts,
		defaultDevice = undefined
	}: { entity: string; shortcuts: MediaShortcut[]; defaultDevice?: string } = $props();

	// the row sits on album art, where a blurred edge says "more this way"
	// better than a clipped chip does
	let cut = $state<ScrollEdges>({ top: false, bottom: false, left: false, right: false });
	let edgeBlur = $derived($hearthConfig.scroll_edge_blur ?? true);

	function play(event: Event, shortcut: MediaShortcut) {
		event.stopPropagation();
		if ($hearthEditMode) return;
		void playSpotifyUri(entity, shortcut.uri, defaultDevice);
	}
</script>

<div class="shortcuts-wrap">
	<div class="shortcuts" use:scrollEdges={{ report: (edges) => (cut = edges) }}>
		{#each shortcuts as shortcut, index (index)}
			<button
				type="button"
				class="shortcut pressable"
				title={shortcut.name}
				use:Ripple={PRESS_RIPPLE}
				onclick={(event) => play(event, shortcut)}
			>
				{#if shortcut.image_url}
					<img src={shortcut.image_url} alt="" />
				{:else}
					<span class="glyph"><Icon name="play_arrow" size={ICON.control} fill /></span>
				{/if}
				<span class="name">{shortcut.name}</span>
			</button>
		{/each}
	</div>
	{#if edgeBlur}
		<ScrollEdge edge="left" size={40} active={cut.left} />
		<ScrollEdge edge="right" size={40} active={cut.right} />
	{/if}
</div>

<style>
	.shortcuts-wrap {
		position: relative;
	}

	.shortcuts {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 2px 0;
		scrollbar-width: none;
	}

	.shortcut {
		flex: none;
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 180px;
		padding: 6px 12px 6px 6px;
		border: 1px solid var(--h-on-art-line);
		border-radius: var(--h-radius-pill);
		background: var(--h-art-scrim-1);
		color: var(--h-on-art-1);
		font: inherit;
		font-size: var(--h-type-secondary);
		cursor: pointer;
		backdrop-filter: blur(6px);
	}

	.shortcut img,
	.glyph {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		object-fit: cover;
		display: grid;
		place-items: center;
		background: var(--h-on-art-fill);
	}

	.name {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
</style>
