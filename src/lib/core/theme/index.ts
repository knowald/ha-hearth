/*
 * Theme tokens, derivation and presets. A theme is a flat map of knob name to
 * value that `themeStyle()` turns into the `--h-*` custom properties every
 * surface reads.
 */

export type HearthTheme = Record<string, string>;

/** Selects the night theme from a Home Assistant entity state. */
export interface DayNightSwitch {
	entity: string;
	night_state?: string;
}

/**
 * Theme knobs exposed in hearth.yaml's `theme:` block, mapped to the CSS
 * custom properties whose defaults live on `.frame` in HearthDashboard.
 * `rgb` knobs accept a hex color and are stored as an R G B triplet so
 * alpha tints can be derived from a single hue.
 */
export const THEME_VARS: Record<string, { cssVar: string; rgb?: boolean; raw?: boolean }> = {
	background_inner: { cssVar: '--h-bg-0' },
	background_outer: { cssVar: '--h-bg-1' },
	// CSS image value ('none' or 'url(...)') layered over the background gradient
	background_image: { cssVar: '--h-bg-image' },
	// gradient drawn over the background image so panels and text stay legible
	// on a bright photo
	background_scrim: { cssVar: '--h-bg-scrim' },
	sheet_top: { cssVar: '--h-sheet-0' },
	sheet_bottom: { cssVar: '--h-sheet-1' },
	overlay: { cssVar: '--h-overlay' },
	surface: { cssVar: '--h-surface-rgb', rgb: true },
	line: { cssVar: '--h-line-rgb', rgb: true },
	fill_scale: { cssVar: '--h-fill-scale', raw: true },
	line_scale: { cssVar: '--h-line-scale', raw: true },
	accent_scale: { cssVar: '--h-accent-scale', raw: true },
	card_shadow: { cssVar: '--h-card-shadow' },
	// backdrop-filter applied to every card, tile and widget surface; 'none'
	// keeps them flat, a blur() value turns them into glass over the background
	surface_blur: { cssVar: '--h-surface-blur', raw: true },
	inset: { cssVar: '--h-inset' },
	track: { cssVar: '--h-track' },
	accent: { cssVar: '--h-accent-rgb', rgb: true },
	accent_deep: { cssVar: '--h-accent-deep' },
	accent_bright: { cssVar: '--h-accent-bright' },
	accent_icon: { cssVar: '--h-accent-icon' },
	accent_text: { cssVar: '--h-accent-text' },
	accent_dim_text: { cssVar: '--h-accent-dim-text' },
	on_accent: { cssVar: '--h-on-accent' },
	label: { cssVar: '--h-label' },
	// inherited from .frame, so one value covers every string on the dashboard;
	// earns its keep over a background photo, where flat text loses its edges
	text_shadow: { cssVar: '--h-text-shadow' },
	cool: { cssVar: '--h-cool-rgb', rgb: true },
	cool_light: { cssVar: '--h-cool-light' },
	cool_icon: { cssVar: '--h-cool-icon' },
	cool_text: { cssVar: '--h-cool-text' },
	on_cool: { cssVar: '--h-on-cool' },
	good: { cssVar: '--h-good' },
	good_text: { cssVar: '--h-good-text' },
	bad: { cssVar: '--h-bad-rgb', rgb: true },
	bad_text: { cssVar: '--h-bad-text' },
	media: { cssVar: '--h-media' },
	media_art_top: { cssVar: '--h-media-art-1' },
	media_art_bottom: { cssVar: '--h-media-art-2' },
	text_1: { cssVar: '--h-text-1' },
	text_2: { cssVar: '--h-text-2' },
	text_3: { cssVar: '--h-text-3' },
	text_4: { cssVar: '--h-text-4' },
	text_5: { cssVar: '--h-text-5' },
	text_6: { cssVar: '--h-text-6' },
	icon: { cssVar: '--h-icon' },
	icon_dim: { cssVar: '--h-icon-dim' },
	font_ui: { cssVar: '--h-font-ui' },
	font_mono: { cssVar: '--h-font-mono' },
	radius_xl: { cssVar: '--h-radius-xl' },
	radius_lg: { cssVar: '--h-radius-lg' },
	radius_card: { cssVar: '--h-radius-card' },
	radius_md: { cssVar: '--h-radius-md' },
	radius_sm: { cssVar: '--h-radius-sm' },
	radius_xs: { cssVar: '--h-radius-xs' }
};

/**
 * Default value for every theme knob - the Calm Hearth look. Serves both as
 * the base `:root` stylesheet (via themeStyle) and as picker defaults when a
 * knob is not set in the user theme.
 */
export const THEME_DEFAULTS: Record<string, string> = {
	background_inner: '#2a2017',
	background_outer: '#16110c',
	background_image: 'none',
	background_scrim: 'none',
	sheet_top: '#2c2118',
	sheet_bottom: '#1d160f',
	overlay: 'rgba(10, 7, 4, 0.62)',
	inset: 'rgba(0, 0, 0, 0.18)',
	track: 'rgba(0, 0, 0, 0.3)',
	font_ui: "'Hanken Grotesk Variable', sans-serif",
	font_mono: "'Geist Mono Variable', monospace",
	radius_xl: '28px',
	radius_lg: '22px',
	radius_card: '20px',
	radius_md: '18px',
	radius_sm: '14px',
	radius_xs: '12px',
	surface: '#ffeedc',
	line: '#ffeedc',
	fill_scale: '1',
	line_scale: '1',
	accent_scale: '1',
	card_shadow: 'none',
	surface_blur: 'none',
	accent: '#f0b860',
	accent_deep: '#e8a04a',
	accent_bright: '#f4c879',
	accent_icon: '#f4c879',
	accent_text: '#f3d9a8',
	accent_dim_text: '#d3b889',
	on_accent: '#1a0f05',
	label: '#a08c6e',
	text_shadow: 'none',
	cool: '#5f9cc0',
	cool_light: '#9fc7d8',
	cool_icon: '#7fb6d9',
	cool_text: '#90a9b4',
	on_cool: '#0c1a22',
	good: '#7fd99a',
	good_text: '#9bc7a8',
	bad: '#e0786e',
	bad_text: '#f0b0a8',
	media: '#1ed760',
	media_art_top: '#5a2230',
	media_art_bottom: '#4a1d28',
	text_1: '#f7efe4',
	text_2: '#f1e6d6',
	text_3: '#cdbfae',
	text_4: '#a99a89',
	text_5: '#8c8073',
	text_6: '#7d7265',
	icon: '#9a8d7d',
	icon_dim: '#7a7064'
};

export function mixHex(a: string, b: string, t: number): string {
	const channel = (offset: number) => {
		const from = parseInt(a.slice(offset, offset + 2), 16);
		const to = parseInt(b.slice(offset, offset + 2), 16);
		return Math.round(from * (1 - t) + to * t)
			.toString(16)
			.padStart(2, '0');
	};
	return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/* Single-color pickers derive their sibling knobs for the theme's luminance. */

export function deriveAccent(hex: string, light = false): HearthTheme {
	if (light) {
		return {
			accent: hex,
			accent_deep: mixHex(hex, '#000000', 0.22),
			accent_bright: mixHex(hex, '#ffffff', 0.18),
			accent_icon: mixHex(hex, '#000000', 0.62),
			accent_text: mixHex(hex, '#000000', 0.35),
			accent_dim_text: mixHex(hex, '#000000', 0.5),
			on_accent: mixHex(hex, '#000000', 0.78)
		};
	}
	return {
		accent: hex,
		accent_deep: mixHex(hex, '#000000', 0.12),
		accent_bright: mixHex(hex, '#ffffff', 0.22),
		accent_icon: mixHex(hex, '#ffffff', 0.22),
		accent_text: mixHex(hex, '#ffffff', 0.45),
		accent_dim_text: mixHex(hex, '#ffffff', 0.18),
		on_accent: mixHex(hex, '#000000', 0.88)
	};
}

export function deriveCool(hex: string, light = false): HearthTheme {
	if (light) {
		return {
			cool: hex,
			cool_light: mixHex(hex, '#000000', 0.1),
			cool_icon: mixHex(hex, '#000000', 0.22),
			cool_text: mixHex(hex, '#000000', 0.38),
			on_cool: '#ffffff'
		};
	}
	return {
		cool: hex,
		cool_light: mixHex(hex, '#ffffff', 0.35),
		cool_icon: mixHex(hex, '#ffffff', 0.2),
		cool_text: mixHex(hex, '#aab4ba', 0.4),
		on_cool: mixHex(hex, '#000000', 0.85)
	};
}

export function deriveBad(hex: string, light = false): HearthTheme {
	return { bad: hex, bad_text: mixHex(hex, light ? '#000000' : '#ffffff', 0.35) };
}

export function deriveBackground(inner: string, outer: string): HearthTheme {
	return {
		background_inner: inner,
		background_outer: outer,
		sheet_top: mixHex(inner, '#ffffff', 0.03),
		sheet_bottom: mixHex(outer, '#ffffff', 0.03)
	};
}

/** Perceived brightness of a hex color, from black (0) to white (1). */
export function luminance(hex: string): number {
	if (!/^#[0-9a-fA-F]{6}$/.test(hex.trim())) return 0;
	const value = hex.trim();
	const [r, g, b] = [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
	return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function isLightTheme(theme?: HearthTheme): boolean {
	const background = theme?.background_outer ?? THEME_DEFAULTS.background_outer;
	return luminance(background) > 0.5;
}

/**
 * The text ladder, from the ink down to the faintest caption. `fade` scales how
 * far each step falls toward the background: below 1 the whole ladder stays
 * closer to the ink, which is what text over a background photo needs, at the
 * cost of some separation between the steps.
 */
export function deriveText(ink: string, background: string, light = false, fade = 1): HearthTheme {
	const step = (factor: number) => mixHex(ink, background, Math.min(1, Math.max(0, factor * fade)));
	return {
		...(light ? { surface: '#ffffff', line: ink } : {}),
		text_1: ink,
		text_2: step(0.07),
		text_3: step(0.19),
		text_4: step(0.35),
		text_5: step(0.48),
		text_6: step(0.54),
		label: step(0.42),
		icon: step(0.41),
		icon_dim: step(0.55),
		...(light ? {} : { surface: mixHex(ink, '#ffffff', 0.35), line: mixHex(ink, '#ffffff', 0.35) })
	};
}

// display names live in the translations, keyed by value in the theme sheet
export const TEXT_CONTRAST_SCALES: { value: string; fade: number }[] = [
	{ value: 'soft', fade: 1.3 },
	{ value: 'normal', fade: 1 },
	{ value: 'high', fade: 0.6 },
	{ value: 'max', fade: 0.3 }
];

export const TEXT_SHADOW_SCALES: { value: string; shadow: string }[] = [
	{ value: 'none', shadow: 'none' },
	{ value: 'soft', shadow: '0 1px 3px rgba(0, 0, 0, 0.35)' },
	{ value: 'strong', shadow: '0 2px 12px rgba(0, 0, 0, 0.6)' }
];

/**
 * Nearest named contrast step for a theme's stored ladder, so the picker shows
 * where a theme sits even when its knobs were written by hand.
 */
export function textContrastOf(theme: HearthTheme): string {
	const ink = theme.text_1 ?? THEME_DEFAULTS.text_1;
	const background = theme.background_outer ?? THEME_DEFAULTS.background_outer;
	const current = luminance(theme.text_5 ?? THEME_DEFAULTS.text_5);
	const light = isLightTheme(theme);
	const distance = (fade: number) =>
		Math.abs(luminance(deriveText(ink, background, light, fade).text_5) - current);
	return TEXT_CONTRAST_SCALES.reduce((nearest, scale) =>
		distance(scale.fade) < distance(nearest.fade) ? scale : nearest
	).value;
}

export const SURFACE_BLUR_SCALES: { value: string; blur: string }[] = [
	{ value: 'none', blur: 'none' },
	{ value: 'light', blur: 'blur(10px) saturate(120%)' },
	{ value: 'medium', blur: 'blur(20px) saturate(140%)' },
	{ value: 'heavy', blur: 'blur(32px) saturate(160%)' }
];

export const RADIUS_SCALES: { value: string; factor: number }[] = [
	{ value: 'sharp', factor: 0.45 },
	{ value: 'soft', factor: 1 },
	{ value: 'round', factor: 1.5 }
];

const RADIUS_BASE: Record<string, number> = {
	radius_xl: 28,
	radius_lg: 22,
	radius_card: 20,
	radius_md: 18,
	radius_sm: 14,
	radius_xs: 12
};

export function deriveRadii(factor: number): HearthTheme {
	return Object.fromEntries(
		Object.entries(RADIUS_BASE).map(([key, base]) => [key, `${Math.round(base * factor)}px`])
	);
}

interface ThemeSeed {
	accent: string;
	cool?: string;
	backgroundInner: string;
	backgroundOuter: string;
	ink: string;
	light?: boolean;
	/** Passed to deriveText; below 1 keeps the whole ladder closer to the ink. */
	textFade?: number;
}

export function buildTheme(seed: ThemeSeed): HearthTheme {
	const light = seed.light ?? false;
	const mediaArtTop = mixHex(seed.accent, seed.backgroundOuter, 0.72);
	return {
		...deriveBackground(seed.backgroundInner, seed.backgroundOuter),
		...deriveText(seed.ink, seed.backgroundOuter, light, seed.textFade),
		...deriveAccent(seed.accent, light),
		...(seed.cool ? deriveCool(seed.cool, light) : {}),
		...(light
			? {
					fill_scale: '8',
					line_scale: '1.1',
					accent_scale: '2.8',
					card_shadow: `0 1px 2px rgb(${hexToTriplet(seed.ink)} / 0.07)`,
					inset: 'rgba(0, 0, 0, 0.05)',
					track: 'rgba(0, 0, 0, 0.08)',
					overlay: 'rgba(30, 24, 16, 0.4)',
					sheet_top: '#ffffff',
					sheet_bottom: mixHex(seed.backgroundInner, '#ffffff', 0.5)
				}
			: {}),
		// fallback album-art stripes when nothing is playing
		media_art_top: mediaArtTop,
		media_art_bottom: mixHex(mediaArtTop, '#000000', 0.15)
	};
}

export const WARM_PAPER_THEME: HearthTheme = {
	...buildTheme({
		accent: '#e9a13b',
		cool: '#5185a8',
		backgroundInner: '#f8f3ea',
		backgroundOuter: '#ede5d7',
		ink: '#241d14',
		light: true
	}),
	good: '#4d7c48',
	good_text: '#3f6b3b',
	bad: '#c0503f',
	bad_text: '#a03a2c',
	media: '#12a04a',
	media_art_top: '#c9a98f',
	media_art_bottom: '#b08f74'
};

export const VOID_THEME: HearthTheme = {
	...buildTheme({
		accent: '#ffb04a',
		cool: '#62b4ea',
		backgroundInner: '#0a0a0a',
		backgroundOuter: '#000000',
		ink: '#f3f5f7'
	}),
	// black wells vanish on a true-black canvas
	sheet_top: '#141414',
	sheet_bottom: '#0c0c0c',
	fill_scale: '1.5',
	line_scale: '1.3',
	track: 'rgba(255, 255, 255, 0.09)',
	inset: 'rgba(255, 255, 255, 0.05)',
	overlay: 'rgba(0, 0, 0, 0.78)',
	good: '#4ee89a',
	good_text: '#7af0b2',
	bad: '#ff7468',
	bad_text: '#ffb0a8'
};

/*
 * Translucent panels floating over the background image. The photo is the
 * user's own - set background_image to a room shot; the scrim keeps text
 * legible when that photo is bright. Without an image the blur has nothing to
 * pick up and the panels read as a plain dark theme.
 */
export const GLASS_THEME: HearthTheme = {
	...buildTheme({
		accent: '#f0b860',
		cool: '#9fc7d8',
		backgroundInner: '#2a2520',
		backgroundOuter: '#14110e',
		ink: '#ffffff',
		// the ladder cannot fade toward a background it does not know: behind
		// glass there is a photo, not the flat colour the other presets assume
		textFade: 0.35
	}),
	text_shadow: '0 2px 12px rgba(0, 0, 0, 0.6)',
	background_scrim: 'linear-gradient(180deg, rgba(10, 8, 6, 0.3), rgba(10, 8, 6, 0.6))',
	surface_blur: 'blur(20px) saturate(140%)',
	// panels carry their weight in the tint and the hairline, not a shadow
	fill_scale: '2.2',
	line_scale: '2',
	accent_scale: '3',
	card_shadow: 'none',
	inset: 'rgba(255, 255, 255, 0.06)',
	track: 'rgba(255, 255, 255, 0.2)',
	overlay: 'rgba(10, 7, 4, 0.55)'
};

// display names are the hearth_theme_preset_<id> translations
export const THEME_PRESETS: { id: string; theme: HearthTheme | null }[] = [
	{ id: 'hearth', theme: null },
	{ id: 'paper', theme: WARM_PAPER_THEME },
	{
		id: 'slate',
		theme: buildTheme({
			accent: '#6fc3c9',
			cool: '#7f9cc9',
			backgroundInner: '#1c2430',
			backgroundOuter: '#0d1218',
			ink: '#eef5f9'
		})
	},
	{ id: 'void', theme: VOID_THEME },
	{ id: 'glass', theme: GLASS_THEME },
	{
		id: 'forest',
		theme: buildTheme({
			accent: '#a8c98a',
			cool: '#7fb6d9',
			backgroundInner: '#1d2418',
			backgroundOuter: '#0f140b',
			ink: '#f0f5e8'
		})
	},
	{
		id: 'plum',
		theme: buildTheme({
			accent: '#d9a3c9',
			cool: '#9fa3e0',
			backgroundInner: '#251b28',
			backgroundOuter: '#130e16',
			ink: '#f5eef7'
		})
	},
	{
		// Cool grey-blue palette.
		// background, white active buttons, Inter, small radii (no background
		// photo - set the background_image knob for one)
		id: 'muted',
		theme: {
			...buildTheme({
				accent: '#e6e8e9',
				cool: '#8fa3ad',
				backgroundInner: '#20262a',
				backgroundOuter: '#14181b',
				ink: '#e3e5e6'
			}),
			...deriveRadii(0.36),
			font_ui: "'Inter Variable', system-ui"
		}
	}
];

function hexToTriplet(value: string) {
	const hex = value.trim();
	if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return value;
	return `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}`;
}

export function themeStyle(theme?: HearthTheme): string {
	if (!theme) return '';
	return Object.entries(theme)
		.filter(([key]) => key in THEME_VARS)
		.map(([key, value]) => {
			const { cssVar, rgb, raw } = THEME_VARS[key];
			// the result lands in a raw <style> tag, so strip anything that could
			// close the tag or the :root block (no legal CSS value needs these)
			const safe = String(value).replace(/[<>{}]/g, '');
			const resolved = rgb ? hexToTriplet(safe) : !raw && /^\d+$/.test(safe) ? `${safe}px` : safe;
			return `${cssVar}: ${resolved};`;
		})
		.join(' ');
}

/**
 * Defaults cover sun.sun, binary sensors, and common day/night template
 * sensors. A configured night_state may contain a comma-separated list.
 */
const NIGHT_STATES = new Set([
	'below_horizon',
	'night',
	'dark',
	'on',
	'true',
	'asleep',
	'sleeping'
]);

export function isNightState(state: string | undefined, config?: DayNightSwitch): boolean {
	if (!config?.entity || !state) return false;
	const current = state.trim().toLowerCase();
	if (config.night_state) {
		return config.night_state
			.split(',')
			.map((entry) => entry.trim().toLowerCase())
			.filter(Boolean)
			.includes(current);
	}
	return NIGHT_STATES.has(current);
}

/*
 * Structural tokens: the type scale, spacing steps, extra radii, layer order,
 * motion and the focus ring. Unlike THEME_VARS these are not user knobs; they
 * exist so every component reads the same scale and the token guard
 * (scripts/check-style-tokens.mjs) can refuse literals.
 */
export const TYPE_SCALE: Record<string, number> = {
	caption: 10,
	label: 11,
	small: 12,
	secondary: 13,
	body: 14,
	emphasis: 15,
	subtitle: 18,
	title: 20,
	headline: 22,
	stat: 24,
	'display-sm': 30,
	display: 34,
	hero: 44,
	clock: 80
};

export const SPACE_SCALE = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 40];

/** Layer order, matching the stack in src/lib/ui/layers.ts from bottom to top. */
export const LAYERS: Record<string, number> = {
	raised: 1,
	chip: 5,
	'grid-header': 6,
	bar: 30,
	toast: 40,
	popover: 45,
	popup: 50,
	search: 55,
	sheet: 60,
	'sheet-popover': 70,
	picker: 80,
	// toasts that must stay readable over any open sheet or popup
	alert: 85,
	confirm: 90,
	screensaver: 100
};

/** Motion durations in ms; the --h-motion-* tokens and JS transitions both read these. */
export const MOTION = { fast: 120, base: 200, slow: 300, theme: 600 } as const;

export const STRUCTURE_CSS = [
	...Object.entries(TYPE_SCALE).map(([name, px]) => `--h-type-${name}: ${px}px;`),
	...SPACE_SCALE.map((px) => `--h-space-${px}: ${px}px;`),
	'--h-radius-hair: 4px;',
	'--h-radius-tight: 8px;',
	'--h-radius-pill: 999px;',
	...Object.entries(LAYERS).map(([name, z]) => `--h-layer-${name}: ${z};`),
	...Object.entries(MOTION).map(([name, ms]) => `--h-motion-${name}: ${ms}ms;`),
	'--h-ease: ease;',
	'--h-focus-ring: 2px solid var(--h-accent-text);',
	// surfaces drawn over artwork or photos: fixed dark scrims and light ink,
	// independent of the theme so they read on any album cover
	'--h-art-scrim-1: rgba(20, 14, 9, 0.55);',
	'--h-art-scrim-2: rgba(20, 14, 9, 0.75);',
	'--h-art-scrim-3: rgba(20, 14, 9, 0.88);',
	'--h-on-art-1: #f3ebe1;',
	'--h-on-art-2: #cdbfae;',
	'--h-on-art-3: #a99a89;',
	'--h-on-art-line: rgba(255, 238, 220, 0.12);',
	'--h-on-art-fill: rgba(255, 238, 220, 0.08);',
	'--h-scrim: rgba(0, 0, 0, 0.55);',
	// elevation by role: modals and sheets, anchored popovers, toasts and bars
	'--h-shadow-layer: 0 40px 100px var(--h-scrim);',
	'--h-shadow-popover: 0 26px 60px var(--h-scrim);',
	'--h-shadow-toast: 0 20px 60px var(--h-scrim);',
	'--h-modal-padding: 22px;',
	'--h-card-padding: 16px 18px;'
].join(' ');

export const SWATCH_COLORS = ['#f4c879', '#f0925f', '#e0788a', '#b39ddb', '#9fc7d8', '#a6cdb2'];
