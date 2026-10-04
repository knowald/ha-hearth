<script lang="ts">
	import { motion } from '$lib/core/app/motion';
	import { states } from '$lib/core/ha/entities';
	import {
		isNightState,
		MOTION,
		STRUCTURE_CSS,
		THEME_DEFAULTS,
		themeDeclarations,
		type HearthTheme
	} from '$lib/core/theme';
	import { ZOOM_GHOST_SHELL } from '$lib/ui/actions/sortable';
	import { FOLD_QUERY } from '../breakpoints';
	import { editedThemeSlot, editor, hearthConfig, hearthEditMode } from '../store';
	import { resolveBackgroundImage } from '../images';
	import { screenSettings } from '../screen';
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

	let chosenTheme = $derived(presetOverride ? (presetOverride.theme ?? undefined) : storedTheme);

	// an uploaded background is stored without the base path, which only the
	// browser knows
	let activeTheme = $derived(
		chosenTheme?.background_image
			? {
					...chosenTheme,
					background_image: resolveBackgroundImage(chosenTheme.background_image)!
				}
			: chosenTheme
	);

	// CSS custom properties do not transition by themselves. Briefly blanket
	// the rendered tree when the switch changes, then release component styles.
	let lastNight: boolean | undefined;

	$effect(() => {
		const switched = lastNight !== undefined && lastNight !== night;
		lastNight = night;
		if (!switched || !$motion) return;
		const root = document.documentElement;
		root.classList.add('theme-fade');
		const timer = setTimeout(() => root.classList.remove('theme-fade'), MOTION.theme);
		return () => {
			clearTimeout(timer);
			root.classList.remove('theme-fade');
		};
	});

	// Reduced motion (configuration or OS) zeroes the motion tokens, and
	// components key their animations off the same attribute. Boot and
	// dashboard both mount this component, so destroy leaves the attribute alone.
	$effect(() => {
		const root = document.documentElement;
		if ($motion) delete root.dataset.motion;
		else root.dataset.motion = 'off';
	});

	const reducedMotionCss =
		":root[data-motion='off'] { " +
		Object.keys(MOTION)
			.map((name) => `--h-motion-${name}: 0ms;`)
			.join(' ') +
		' }';

	// The root zoom scales viewport units and safe-area insets too; these
	// tokens undo it so a box sized against the viewport still fits the screen
	// at any scale. --h-dvh falls back to vh for kiosk webviews without dynamic
	// units, where a var() holding dvh would otherwise drop the whole declaration.
	const VIEWPORT_CSS =
		'--h-vw: calc(1vw / var(--h-zoom)); --h-vh: calc(1vh / var(--h-zoom)); --h-dvh: var(--h-vh); ' +
		['top', 'right', 'bottom', 'left']
			.map((side) => `--h-safe-${side}: calc(env(safe-area-inset-${side}, 0px) / var(--h-zoom));`)
			.join(' ');
	const VIEWPORT_DYNAMIC_CSS =
		'@supports (height: 1dvh) { :root { --h-dvh: calc(1dvh / var(--h-zoom)); } }';
	// see nestZoomedGhost; the shell drops the item's own styles (inline
	// position and size from SortableJS still apply) and undoes the zoom
	const DRAG_GHOST_CSS =
		`.${ZOOM_GHOST_SHELL} { all: unset; display: block; zoom: calc(1 / var(--h-zoom)); } ` +
		`.${ZOOM_GHOST_SHELL} > * { zoom: var(--h-zoom); box-sizing: border-box; width: 100%; height: 100%; margin: 0; }`;

	// media queries see the physical viewport, so the zoom does not move the fold
	let mobileCss = $derived.by(() => {
		const { mobile_padding_x: x, mobile_padding_y: y } = $hearthConfig;
		const scale = $screenSettings.mobileScale;
		const declarations =
			(x === undefined ? '' : `--h-pad-x: ${Math.max(0, x)}px; `) +
			(y === undefined ? '' : `--h-pad-y: ${Math.max(0, y)}px; `) +
			(scale === undefined || !zoomSupported ? '' : `--h-zoom: ${scale / 100}; `);
		return declarations ? `@media ${FOLD_QUERY} { :root { ${declarations}} }` : '';
	});

	/*
	 * Theme tokens live on :root (not .frame) so modals portaled outside the
	 * frame resolve them too. They go through the CSSOM, never into the
	 * stylesheet text below: a value from a hand-edited or imported theme then
	 * cannot end its property or the rule. Defaults first, so a value the
	 * browser rejects leaves the default in place. The sheet goes ahead of the
	 * custom CSS, which may override any token.
	 */
	let themeRule = $state<CSSStyleRule | null>(null);

	$effect(() => {
		const element = document.createElement('style');
		element.dataset.hearthTheme = '';
		const custom = document.getElementById('ha-hearth-custom-css');
		if (custom) custom.before(element);
		else document.head.append(element);
		element.sheet!.insertRule(':root {}', 0);
		themeRule = element.sheet!.cssRules[0] as CSSStyleRule;
		return () => {
			element.remove();
			themeRule = null;
		};
	});

	$effect(() => {
		if (!themeRule) return;
		const style = themeRule.style;
		style.cssText = '';
		for (const [property, value] of [
			...themeDeclarations(THEME_DEFAULTS),
			...themeDeclarations(activeTheme)
		]) {
			style.setProperty(property, value);
		}
	});

	let rootCss = $derived(
		`:root { ${STRUCTURE_CSS} ` +
			`--h-pad-x: ${Math.max(0, $hearthConfig.padding_x ?? 0)}px; ` +
			`--h-pad-y: ${Math.max(0, $hearthConfig.padding_y ?? 0)}px; ` +
			`--h-zoom: ${zoomSupported ? $screenSettings.scale / 100 : 1}; zoom: var(--h-zoom); ${VIEWPORT_CSS} } ` +
			`${VIEWPORT_DYNAMIC_CSS} ${DRAG_GHOST_CSS} ${mobileCss} ${reducedMotionCss}`
	);
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- generated from numbers and constants; theme tokens go through the CSSOM above -->
	{@html `<style>${rootCss}</style>`}
</svelte:head>
