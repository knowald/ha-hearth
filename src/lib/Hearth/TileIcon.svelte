<script lang="ts">
	import Icon from './Icon.svelte';
	import type { IconMotion } from './iconMotion';

	let {
		name,
		size,
		color,
		fill = false,
		motion = undefined
	}: { name: string; size: number; color?: string; fill?: boolean; motion?: IconMotion } = $props();
</script>

<!-- the wrapper stays put so a state change only swaps the attribute -->
<span
	class="tile-icon"
	data-icon-motion={motion?.kind}
	style:--icon-turn={motion?.duration}
	style:--icon-glow={motion?.color}
>
	<Icon {name} {size} {color} {fill} />
	{#if motion?.kind === 'bars'}
		<span class="bars" aria-hidden="true"><span></span><span></span><span></span></span>
	{/if}
</span>

<style>
	.tile-icon {
		position: relative;
		display: inline-flex;
		flex: none;
	}

	[data-icon-motion='spin'] :global(.mi) {
		animation: tile-icon-spin var(--icon-turn) linear infinite;
	}

	[data-icon-motion='sway'] :global(.mi) {
		animation: tile-icon-sway calc(var(--h-motion-theme) * 3) ease-in-out infinite;
	}

	[data-icon-motion='pulse'] :global(.mi) {
		animation: tile-icon-pulse calc(var(--h-motion-theme) * 4) ease-in-out infinite;
	}

	/* set on the root while the sleep screen covers the tiles or the page is edited */
	:global(html[data-tile-motion='paused']) .tile-icon :global(.mi),
	:global(html[data-tile-motion='paused']) .bars span {
		animation-play-state: paused;
	}

	[data-icon-motion='glow'] :global(.mi) {
		filter: drop-shadow(0 0 6px var(--icon-glow));
	}

	/* three short bars in the icon's lower corner, like a level meter */
	.bars {
		position: absolute;
		right: -2px;
		bottom: -2px;
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 10px;
	}

	.bars span {
		width: 2px;
		height: 100%;
		border-radius: var(--h-radius-hair);
		background: var(--tile-accent, var(--h-accent-icon));
		transform-origin: bottom;
		animation: tile-icon-bar calc(var(--h-motion-slow) * 3) ease-in-out infinite alternate;
	}

	.bars span:nth-child(2) {
		animation-delay: calc(var(--h-motion-slow) * -1);
	}

	.bars span:nth-child(3) {
		animation-delay: calc(var(--h-motion-slow) * -2);
	}

	@keyframes tile-icon-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes tile-icon-sway {
		0%,
		100% {
			transform: translateX(0) rotate(0);
		}
		25% {
			transform: translateX(-2px) rotate(-6deg);
		}
		75% {
			transform: translateX(2px) rotate(6deg);
		}
	}

	@keyframes tile-icon-pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.7;
			transform: scale(0.92);
		}
	}

	@keyframes tile-icon-bar {
		from {
			transform: scaleY(0.3);
		}
		to {
			transform: scaleY(1);
		}
	}
</style>
