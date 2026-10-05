<script lang="ts">
	import { minuteTimer } from '$lib/core/app/clock';
	import { deviceName } from '$lib/core/app/device';
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
	import { derived } from 'svelte/store';
	import { ZOOM_GHOST_SHELL } from '$lib/ui/actions/sortable';
	import { FOLD_QUERY } from '../breakpoints';
	import { displayTimeZone, editedThemeSlot, editor, hearthConfig, hearthEditMode } from '../store';
	import { resolveBackgroundImage } from '../images';
	import {
		activeLook,
		ensureSavedThemes,
		monthDayOf,
		needsSavedThemes,
		savedThemes,
		scheduledIndex
	} from '../themeSchedule';
	import { evaluateVisibility } from '../visibility';
	import { screenSettings } from '../screen';
	import { zoomSupported } from '../zoom';

	let {
		presetOverride = undefined,
		pageId = undefined
	}: {
		/** A display-only preset from ?theme=, replacing the stored theme without touching the config. */
		presetOverride?: { theme: HearthTheme | null };
		/** The page on screen, whose own look goes over the theme. */
		pageId?: string;
	} = $props();

	// While editing, preview the selected slot. At runtime the configured HA
	// entity decides whether the full day or night theme is active.
	let editingTheme = $derived($hearthEditMode && $editor?.kind === 'theme');
	let night = $derived(
		editingTheme
			? $editedThemeSlot === 'night'
			: isNightState(
					$states?.[$hearthConfig.day_night?.entity ?? '']?.state,
					$hearthConfig.day_night
				)
	);

	// the date only matters to a schedule; nothing ticks without one
	const scheduleClock = derived(hearthConfig, ($config, set: (now?: Date) => void) => {
		if (!$config.theme_schedule?.length) {
			set(undefined);
			return;
		}
		return minuteTimer.subscribe(set);
	});
	let now = $derived($scheduleClock);

	$effect(() => {
		if (needsSavedThemes($hearthConfig)) ensureSavedThemes();
	});

	// a number, so a state change that leaves the same entry holding stops here
	let entryIndex = $derived(
		editingTheme || !now
			? -1
			: scheduledIndex($hearthConfig.theme_schedule, monthDayOf(now, $displayTimeZone), (when) =>
					evaluateVisibility(
						when,
						$states,
						{},
						{
							device: $deviceName,
							now,
							timeZone: $displayTimeZone
						}
					)
				)
	);

	// the theme sheet shows the slot it edits, without the schedule or a page's look
	let lookTheme = $derived(
		editingTheme
			? night
				? ($hearthConfig.theme_night ?? $hearthConfig.theme)
				: $hearthConfig.theme
			: activeLook($hearthConfig, { night, entryIndex, pageId, saved: $savedThemes })
	);

	let chosenTheme = $derived(presetOverride ? (presetOverride.theme ?? undefined) : lookTheme);

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

	/*
	 * Declarations are compared as text before the rule is touched, so a
	 * config or state change that leaves the theme as it was costs nothing.
	 * CSS custom properties do not transition by themselves: when the tokens
	 * do change (day and night, a schedule entry, a page with a look of its
	 * own), the rendered tree is briefly blanketed by a fade. Editing in the
	 * theme sheet, and opening or closing it, does not fade.
	 */
	let applied: string | undefined;
	let wasEditing = false;
	let fadeTimer: ReturnType<typeof setTimeout> | undefined;

	function fade() {
		const root = document.documentElement;
		clearTimeout(fadeTimer);
		root.classList.add('theme-fade');
		fadeTimer = setTimeout(() => root.classList.remove('theme-fade'), MOTION.theme);
	}

	$effect(() => {
		return () => {
			clearTimeout(fadeTimer);
			document.documentElement.classList.remove('theme-fade');
		};
	});

	$effect(() => {
		if (!themeRule) {
			applied = undefined;
			return;
		}
		const declarations = [...themeDeclarations(THEME_DEFAULTS), ...themeDeclarations(activeTheme)];
		const serialized = JSON.stringify(declarations);
		const fades = applied !== undefined && !editingTheme && !wasEditing && $motion > 0;
		wasEditing = editingTheme;
		if (serialized === applied) return;
		applied = serialized;
		const style = themeRule.style;
		style.cssText = '';
		for (const [property, value] of declarations) style.setProperty(property, value);
		if (fades) fade();
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
