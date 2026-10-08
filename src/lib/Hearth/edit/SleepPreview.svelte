<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { screensaverPreview } from '../store';
	import Scene from '../screensaver/Scene.svelte';
	import Icon from '../Icon.svelte';
	import { ICON } from '../iconSizes';

	let { positionX, positionY }: { positionX?: number; positionY?: number } = $props();
	// a quarter of a short landscape phone still leaves the settings room to scroll
	const MAX_HEIGHT = 'min(180px, 25 * var(--h-vh))';
	let screenWidth = $state(1280);
	let screenHeight = $state(800);
	let previewWidth = $state(0);
	let visible = $state(true);
	let zoom = $state(1);
	let width = $derived(screenWidth / zoom);
	let height = $derived(screenHeight / zoom);

	function measure(node: HTMLElement) {
		function resize() {
			zoom = node.currentCSSZoom || 1;
			previewWidth = node.clientWidth;
		}
		resize();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(resize);
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}

	// scrolling past the preview and back should not rebuild a radar map each time
	const HIDE_DELAY = 2000;

	function watchVisibility(node: HTMLElement) {
		if (typeof IntersectionObserver === 'undefined') return;
		let hideTimer: ReturnType<typeof setTimeout> | undefined;
		const observer = new IntersectionObserver(([entry]) => {
			clearTimeout(hideTimer);
			if (entry.isIntersecting) visible = true;
			else hideTimer = setTimeout(() => (visible = false), HIDE_DELAY);
		});
		observer.observe(node);
		return {
			destroy: () => {
				clearTimeout(hideTimer);
				observer.disconnect();
			}
		};
	}
</script>

<svelte:window bind:innerWidth={screenWidth} bind:innerHeight={screenHeight} />

<div class="preview" use:watchVisibility>
	<div class="preview-header">
		<span>{$lang('hearth_live_preview')}</span>
		<button
			type="button"
			aria-label={$lang('hearth_preview_sleep_screen')}
			title={$lang('hearth_preview_sleep_screen')}
			onclick={() => screensaverPreview.set(true)}
		>
			<Icon name="fullscreen" size={ICON.control} />
		</button>
	</div>
	<div
		class="frame"
		style:aspect-ratio={`${width} / ${height}`}
		style:width={`min(100%, calc(${MAX_HEIGHT} * ${width / height}))`}
		use:measure
		role="img"
		aria-label={$lang('hearth_live_preview')}
	>
		<div
			class="stage"
			style:width={`${width}px`}
			style:height={`${height}px`}
			style:transform={`scale(${previewWidth / width})`}
			style:--h-vw={`${width / 100}px`}
			style:--h-vh={`${height / 100}px`}
		>
			<Scene
				active={visible && previewWidth > 0 && !$screensaverPreview}
				preview
				{positionX}
				{positionY}
			/>
		</div>
	</div>
</div>

<style>
	.preview {
		padding: 10px;
		background: var(--h-sheet-1);
		border-radius: var(--h-radius-xs);
	}
	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
		color: var(--h-label);
		font-size: var(--h-type-label);
	}
	.preview-header button {
		display: grid;
		place-items: center;
		padding: 6px;
		border: 0;
		border-radius: var(--h-radius-xs);
		background: var(--h-inset);
		color: var(--h-icon);
		cursor: pointer;
	}
	.frame {
		position: relative;
		overflow: hidden;
		margin: 0 auto;
		border-radius: var(--h-radius-xs);
		background: #030201; /* literal ok: matches the OLED sleep screen */
	}
	.stage {
		position: absolute;
		inset: 0;
		transform-origin: top left;
		pointer-events: none;
	}
</style>
