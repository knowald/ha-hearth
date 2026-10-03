<script lang="ts">
	import { motion } from '$lib/core/app/motion';
	import { states } from '$lib/core/ha/entities';
	import {
		isNightState,
		STRUCTURE_CSS,
		THEME_DEFAULTS,
		themeStyle,
		type HearthTheme
	} from '$lib/core/theme';
	import { THEME_BRIDGE_CSS } from '$lib/legacy/bridge/themeBridge';
	import { editedThemeSlot, editor, hearthConfig, hearthEditMode } from '../store';
	import { zoomSupported } from '../zoom';

	/** A display-only preset from ?theme=, replacing the stored theme without touching the config. */
	let { presetOverride = undefined }: { presetOverride?: { theme: HearthTheme | null } } = $props();

	// While editing, preview the selected slot. At runtime the configured HA
	// entity decides whether the full day or night theme is active.
	let night = $derived(
		$hearthEditMode && $editor?.kind === 'theme'
			? $editedThemeSlot === 'night'
			: isNightState(
					$states?.[$hearthConfig.day_night?.entity ?? '']?.state,
					$hearthConfig.day_night
				)
	);

	let storedTheme = $derived(
		night ? ($hearthConfig.theme_night ?? $hearthConfig.theme) : $hearthConfig.theme
	);

	let activeTheme = $derived(presetOverride ? (presetOverride.theme ?? undefined) : storedTheme);

	// CSS custom properties do not transition by themselves. Briefly blanket
	// the rendered tree when the switch changes, then release component styles.
	let lastNight: boolean | undefined;

	$effect(() => {
		const switched = lastNight !== undefined && lastNight !== night;
		lastNight = night;
		if (!switched || !$motion) return;
		const root = document.documentElement;
		root.classList.add('theme-fade');
		const timer = setTimeout(() => root.classList.remove('theme-fade'), 700);
		return () => {
			clearTimeout(timer);
			root.classList.remove('theme-fade');
		};
	});

	// The root zoom scales viewport units too; these tokens undo it so a box
	// sized against the viewport still fits the screen at any scale. --h-dvh
	// falls back to vh for kiosk webviews without dynamic units, where a var()
	// holding dvh would otherwise drop the whole declaration.
	const VIEWPORT_CSS =
		'--h-vw: calc(1vw / var(--h-zoom)); --h-vh: calc(1vh / var(--h-zoom)); --h-dvh: var(--h-vh);';
	const VIEWPORT_DYNAMIC_CSS =
		'@supports (height: 1dvh) { :root { --h-dvh: calc(1dvh / var(--h-zoom)); } }';
	// SortableJS sizes and moves its touch-drag ghost in screen pixels, so the
	// ghost undoes the zoom and its content takes it back
	const DRAG_GHOST_CSS =
		'.sortable-fallback { zoom: calc(1 / var(--h-zoom)); } .sortable-fallback > * { zoom: var(--h-zoom); }';

	// matches the layout's phone breakpoint in HearthDashboard; media queries
	// see the physical viewport, so the zoom does not move it
	let mobileCss = $derived.by(() => {
		const { mobile_padding_x: x, mobile_padding_y: y, mobile_scale: scale } = $hearthConfig;
		const declarations =
			(x === undefined ? '' : `--h-pad-x: ${Math.max(0, x)}px; `) +
			(y === undefined ? '' : `--h-pad-y: ${Math.max(0, y)}px; `) +
			(scale === undefined || !zoomSupported ? '' : `--h-zoom: ${scale / 100}; `);
		return declarations ? `@media (max-width: 900px) { :root { ${declarations}} }` : '';
	});

	// tokens live on :root (not .frame) so modals portaled outside the frame
	// resolve them too; base first, user theme overrides second
	let rootCss = $derived(
		`:root { ${STRUCTURE_CSS} ${themeStyle(THEME_DEFAULTS)} ${themeStyle(activeTheme)} ${THEME_BRIDGE_CSS} ` +
			`--h-pad-x: ${Math.max(0, $hearthConfig.padding_x ?? 0)}px; ` +
			`--h-pad-y: ${Math.max(0, $hearthConfig.padding_y ?? 0)}px; ` +
			`--h-zoom: ${zoomSupported ? ($hearthConfig.scale ?? 100) / 100 : 1}; zoom: var(--h-zoom); ${VIEWPORT_CSS} }` +
			VIEWPORT_DYNAMIC_CSS +
			DRAG_GHOST_CSS +
			mobileCss
	);
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- generated from theme tokens, never user text -->
	{@html `<style>${rootCss}</style>`}
</svelte:head>
