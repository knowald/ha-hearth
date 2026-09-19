<script lang="ts">
	/*
	 * Progressive blur for the edge of a scroll container. CSS has no variable
	 * blur radius, so the band is five full-size layers whose backdrop blur
	 * doubles from one to the next, each masked to an overlapping slice of the
	 * band. The slices cross-fade, and the eye reads one blur that deepens
	 * toward the edge rather than a sharp copy laid over a blurred one.
	 *
	 * It must be a sibling of the scroll container, not a child: `backdrop-filter`
	 * blurs whatever is painted behind, so the content passes under a band that
	 * stays put. Pair it with the `scrollEdges` action and only show the band
	 * when that edge actually cuts something off - over a background photo a
	 * permanent band reads as a smudge.
	 */
	type Edge = 'top' | 'bottom' | 'left' | 'right';

	let {
		edge = 'bottom',
		size = 110,
		active = true
	}: { edge?: Edge; size?: number; active?: boolean } = $props();

	// the blur deepens toward the edge, which is also where the masks point
	let toward = $derived(`to ${edge}`);
</script>

<div
	class="edge"
	class:top={edge === 'top'}
	class:bottom={edge === 'bottom'}
	class:left={edge === 'left'}
	class:right={edge === 'right'}
	class:active
	style:--edge-size="{size}px"
	style:--edge-toward={toward}
	aria-hidden="true"
>
	<div></div>
	<div></div>
	<div></div>
	<div></div>
	<div></div>
</div>

<style>
	.edge {
		position: absolute;
		pointer-events: none;
		opacity: 0;
		/* hidden rather than transparent: an invisible layer still costs a
		   backdrop pass, and these come in fives */
		visibility: hidden;
		transition:
			opacity var(--h-motion-fast) ease,
			visibility var(--h-motion-fast);
	}

	.edge.active {
		opacity: 1;
		visibility: visible;
	}

	.edge.top,
	.edge.bottom {
		left: 0;
		right: 0;
		height: var(--edge-size);
	}

	.edge.top {
		top: 0;
	}

	.edge.bottom {
		bottom: 0;
	}

	.edge.left,
	.edge.right {
		top: 0;
		bottom: 0;
		width: var(--edge-size);
	}

	.edge.left {
		left: 0;
	}

	.edge.right {
		right: 0;
	}

	.edge > div {
		position: absolute;
		inset: 0;
	}

	.edge > div:nth-child(1) {
		backdrop-filter: blur(0.75px);
		mask-image: linear-gradient(
			var(--edge-toward),
			transparent 0%,
			black 20%,
			black 40%,
			transparent 60%
		);
		-webkit-mask-image: linear-gradient(
			var(--edge-toward),
			transparent 0%,
			black 20%,
			black 40%,
			transparent 60%
		);
	}

	.edge > div:nth-child(2) {
		backdrop-filter: blur(1.5px);
		mask-image: linear-gradient(
			var(--edge-toward),
			transparent 20%,
			black 40%,
			black 60%,
			transparent 80%
		);
		-webkit-mask-image: linear-gradient(
			var(--edge-toward),
			transparent 20%,
			black 40%,
			black 60%,
			transparent 80%
		);
	}

	.edge > div:nth-child(3) {
		backdrop-filter: blur(3px);
		mask-image: linear-gradient(
			var(--edge-toward),
			transparent 40%,
			black 60%,
			black 80%,
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			var(--edge-toward),
			transparent 40%,
			black 60%,
			black 80%,
			transparent 100%
		);
	}

	.edge > div:nth-child(4) {
		backdrop-filter: blur(6px);
		mask-image: linear-gradient(var(--edge-toward), transparent 60%, black 80%);
		-webkit-mask-image: linear-gradient(var(--edge-toward), transparent 60%, black 80%);
	}

	.edge > div:nth-child(5) {
		backdrop-filter: blur(12px);
		mask-image: linear-gradient(var(--edge-toward), transparent 80%, black 100%);
		-webkit-mask-image: linear-gradient(var(--edge-toward), transparent 80%, black 100%);
	}
</style>
