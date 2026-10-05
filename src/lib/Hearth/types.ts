import type * as v from 'valibot';
import type { SliderUpdateMode } from '$lib/core/app/configuration';
import type {
	ActionSchema,
	EntityRefSchema,
	MediaShortcutSchema,
	SceneRefSchema,
	StyleRuleSchema,
	VacuumModeRefSchema,
	VisibilityConditionSchema
} from './schema';
import type { VerdictBands } from '$lib/core/domains/sensor';
import type { DayNightSwitch, HearthTheme, ScrimLevel } from '$lib/core/theme';

export type { DayNightSwitch, HearthTheme, ScrimLevel, VerdictBands };

/*
 * The configuration vocabulary: pages, cards, widgets and their references.
 * Per-type card and widget shapes are declared next to their descriptors under
 * cards/ and widgets/ and assembled into the unions here.
 */

/**
 * A dashboard page. Home is one of these too - it has no special layout, no
 * special storage and no special editing path.
 */
export interface HearthRoom {
	id: string;
	name: string;
	icon: string;
	summary?: string;
	temp_entity?: string;
	humidity_entity?: string;
	// drops the built-in page header; a `header` card can take its place
	hide_header?: boolean;
	// the page fills the screen instead of scrolling: cards that stretch share
	// the leftover height and anything past the bottom edge is clipped
	fill_screen?: boolean;
	// fixes the page's card column count
	columns?: number;
	// the page leaves navigation while these do not hold; edit mode keeps it
	visibility?: VisibilityCondition[];
	/** A URL or `hearth-images/<file>`, shown behind the dashboard while this page is open. */
	background_image?: string;
	// the shade over that image; there always is one, medium when unset
	background_scrim?: ScrimLevel;
	/** A preset id or a saved theme's name, worn while this page is open in the day. */
	theme?: string;
	cards: OverviewItem[][];
}

/** A preset id, a saved theme's name, or the theme's tokens written out. */
export type ThemeChoice = string | HearthTheme;

/**
 * Replaces the day theme while it holds: from `from` to `to` (MM-DD, both
 * days included, across the new year when from is later), and while every
 * `when` condition holds. The first entry that holds wins.
 */
export interface ThemeScheduleEntry {
	theme: ThemeChoice;
	// replaces theme_night as well; without it the night theme stays
	night?: ThemeChoice;
	from?: string;
	to?: string;
	when?: VisibilityCondition[];
}

/** A configured tap or hold action; see ActionSchema. */
export type HearthAction = v.InferOutput<typeof ActionSchema>;
export type EntityRef = v.InferOutput<typeof EntityRefSchema>;
export type SceneRef = v.InferOutput<typeof SceneRefSchema>;
export type StyleRule = v.InferOutput<typeof StyleRuleSchema>;
export type VacuumModeRef = v.InferOutput<typeof VacuumModeRefSchema>;
export type VisibilityCondition = v.InferOutput<typeof VisibilityConditionSchema>;
export type MediaShortcut = v.InferOutput<typeof MediaShortcutSchema>;

type RailWidgetVariant =
	| {
			id: string;
			type: 'clock';
			timezone?: string;
			hour_format?: 'auto' | '12' | '24';
			show_seconds?: boolean;
	  }
	| { id: string; type: 'weather'; entity?: string }
	| { id: string; type: 'search' }
	| { id: string; type: 'nav' }
	// a gap in the rail: flexible (absorbs leftover height) unless height fixes
	// it in px; line draws a divider across the middle of the gap
	| { id: string; type: 'spacer'; line?: boolean; height?: number }
	| { id: string; type: 'label'; text?: string; divider?: boolean }
	// price is a static amount per kWh; price_entity overrides it when set
	| {
			id: string;
			type: 'energy';
			entity?: string;
			price?: number;
			price_entity?: string;
			currency?: string;
			// false hides the badge shown while today runs below the past week
			average_badge?: boolean;
	  }
	// generic running-activity row (washer, 3d print, charging, ...); hidden
	// unless the status entity is active - by the active_states list when given,
	// otherwise by not being in a common idle-state set
	| {
			id: string;
			type: 'progress';
			name?: string;
			icon?: string;
			status_entity?: string;
			progress_entity?: string;
			// appended verbatim to the progress value readout, e.g. "%"
			unit?: string;
			remaining_entity?: string;
			active_states?: string[];
			// states that mark a just-finished activity; the row remains dismissible
			// for completion_delay_minutes before hiding automatically
			completed_states?: string[];
			completion_delay_minutes?: number;
	  }
	| {
			id: string;
			type: 'calendar';
			entities?: string[];
			travel_entity?: string;
			lookahead_hours?: number;
	  }
	| {
			id: string;
			type: 'status';
			icon?: string;
			text?: string;
			entity?: string;
			tap_action?: HearthAction;
			hold_action?: HearthAction;
	  }
	| {
			id: string;
			type: 'entity';
			entity?: string;
			name?: string;
			icon?: string;
			vertical_padding?: 'compact';
	  }
	// one sensor drawn as a line over time, a state timeline, a bar or a radial
	// gauge; math rewrites the value (x) before display
	| {
			id: string;
			type: 'chart';
			entity?: string;
			name?: string;
			style?: 'line' | 'history' | 'bar' | 'radial';
			period?: 'hour' | 'day' | 'week' | 'month';
			math?: string;
			stroke?: number;
	  }
	| { id: string; type: 'template'; template?: string }
	| { id: string; type: 'timer'; entity?: string; name?: string }
	| { id: string; type: 'notifications' }
	| { id: string; type: 'iframe'; url?: string; height?: number };

/** Where a widget goes once the rail folds under the page. */
export type MobileSlot = 'top' | 'bottom' | 'hidden';

/** Where the rail sits beside the page on a wide screen, if anywhere. */
export type RailPosition = 'left' | 'right' | 'both' | 'none';

/** Which of the two rails a widget belongs to when there are two. */
export type RailSide = 'left' | 'right';

export type RailWidget = RailWidgetVariant & {
	/*
	 * Unset takes the slot from the rail's own shape: everything before the
	 * first flexible gap rides above the page, the rest below it. See
	 * railSlots in config.ts.
	 */
	mobile?: MobileSlot;
	/** Superseded by `mobile: 'hidden'`, still read from configs that set it. */
	hide_mobile?: boolean;
	/** Only read while `rail_position` is `both`; unset is the left rail. */
	side?: RailSide;
	visibility?: VisibilityCondition[];
};

type OverviewCardVariant =
	// the room-style page header as a plain card, usable on any dashboard
	| {
			id: string;
			type: 'header';
			title?: string;
			subtitle?: string;
			icon?: string;
			temp_entity?: string;
			humidity_entity?: string;
			/** A URL, or `hearth-images/<file>` for an uploaded image. */
			background_image?: string;
	  }
	// height fixes the card in px; without it the card fills its column
	| {
			id: string;
			type: 'temperature';
			label?: string;
			entity?: string;
			unit?: string;
			// climate entity that turns the card into a thermostat: target readout,
			// +/- controls and a dashed target line on the history chart
			climate_entity?: string;
			// same semantics as EntityRef.verdict, for the card's headline sensor
			verdict?: false | VerdictBands;
			height?: number;
	  }
	// shortcuts are one-tap Spotify URIs; default_device names the Connect
	// device they start on when nothing is playing yet
	| {
			id: string;
			type: 'media';
			entity?: string;
			height?: number;
			shortcuts?: MediaShortcut[];
			default_device?: string;
	  }
	// battery_entity and bin_entity add readings to the popover status line for
	// integrations that expose them as separate entities; battery falls back to
	// the vacuum's own battery_level attribute
	| {
			id: string;
			type: 'vacuum';
			entity?: string;
			modes?: VacuumModeRef[];
			battery_entity?: string;
			bin_entity?: string;
			// restores the one-tap Clean/Stop button next to the summary row
			quick_action?: boolean;
	  }
	// the general-purpose grid: any mix of domains, tiles adapt per domain
	// (lights dim on drag, covers show position). `stat` renders big sensor
	// readouts instead of tiles; `columns` fixes the column count.
	| {
			id: string;
			type: 'entities';
			title?: string;
			style?: 'tile' | 'stat';
			columns?: number;
			// a titled section counts by default; false opts out
			show_count?: boolean;
			// header verbs (All off / Open all / Close all) render automatically
			// for multi-light and multi-cover grids; false hides them
			group_actions?: boolean;
			// restores the per-tile controls glyph for surfaces where the
			// long-press gesture is unwanted
			tune_button?: boolean;
			vertical_padding?: 'compact';
			// every tile is a readout unless the entity overrides it; see
			// EntityRef.readonly
			readonly?: boolean;
			// default for draggable controls; individual entities may override it
			slider_updates?: SliderUpdateMode;
			/** `*` glob expanded against the live Home Assistant entity registry. */
			wildcard?: string;
			// collapses the grid into a single summary row; tapping it opens the
			// entities in a popover anchored to the row, so the layout never shifts
			collapsed?: boolean;
			// summary row icon, defaulting to the first entity's domain icon
			icon?: string;
			// summary row caption: the static text, else the state of summary_entity,
			// else a count of the entities that are on
			summary?: string;
			summary_entity?: string;
			entities: EntityRef[];
	  }
	| { id: string; type: 'camera'; entity?: string; title?: string; stream?: boolean }
	// integration-provided still images, including native Roborock floor maps
	| { id: string; type: 'image'; entity?: string; title?: string }
	| { id: string; type: 'climate'; entity?: string; title?: string }
	// `bar` renders the persistent scene row: equal-width tiles, active one lit
	| { id: string; type: 'scenes'; title?: string; style?: 'chips' | 'bar'; scenes: SceneRef[] }
	| { id: string; type: 'iframe'; url?: string; title?: string; height?: number }
	// Markdown rendered from a Home Assistant template; entities only names what
	// the template reads, for the features that look up a card's entities
	| {
			id: string;
			type: 'template';
			content?: string;
			title?: string;
			icon?: string;
			entities?: string[];
	  }
	// days since an input_datetime was last reset, with a one-tap reset
	| { id: string; type: 'days_since'; entity?: string; title?: string; icon?: string }
	// a todo.* list: tick, add, rename and delete items as the list allows.
	// Completed items sit in a section that starts open with show_completed.
	| {
			id: string;
			type: 'todo';
			entity?: string;
			title?: string;
			show_completed?: boolean;
			/** Unset keeps the list's own order. */
			sort?: 'alphabetical' | 'due';
			hide_add?: boolean;
	  }
	// the media card for whichever listed player is active; a paused player
	// keeps the card for timeout seconds before the next one takes over
	| {
			id: string;
			type: 'conditional_media';
			media_players: string[];
			timeout?: number;
			height?: number;
	  };

/**
 * `fill` is a share of the leftover height in the card's column: 0 (or unset,
 * for most types) sizes to content, 1 takes one share, 2 takes twice as much as
 * a 1. Media and sensor cards fill by default, which is how they behaved before
 * the option existed. A fixed `height` wins over any weight.
 */
export type OverviewCard = OverviewCardVariant & {
	visibility?: VisibilityCondition[];
	fill?: number;
	// columns a top-level card covers on a wide page; see spanRows in config.ts
	span?: CardSpan;
};

export type CardSpan = 2 | 3 | 'full';

/**
 * A named horizontal or vertical layout container, parity with the original
 * dashboard's horizontal-stack/vertical-stack. One level deep only - a
 * stack's children are always plain cards, never another stack.
 */
export interface OverviewStack {
	id: string;
	kind: 'stack';
	title?: string;
	direction: 'horizontal' | 'vertical';
	// same share-of-leftover-height meaning as on a card
	fill?: number;
	cards: OverviewCard[];
}

/** Anything that can occupy a top-level slot in an overview column. */
export type OverviewItem = OverviewCard | OverviewStack;

export type AlertSeverity = 'info' | 'warning' | 'critical';

/** A short synthesized tone; `true` is the plain chime. */
export type AlertChime = true | 'soft' | 'bell' | 'none';

/** The chime per severity for rules that name none, and how loud chimes play. */
export interface AlertChimes {
	info?: AlertChime;
	warning?: AlertChime;
	critical?: AlertChime;
	/** 1 to 100 percent; 60 when unset. */
	volume?: number;
}

/** Greets a person on the header and the sleep screen for a while after they come home. */
export interface PresenceGreeting {
	persons: string[];
	/** How long after the arrival a screen may still greet; 10 when unset. */
	minutes?: number;
}

/**
 * An alert raised from entity states: it fires once every condition has held
 * for for_seconds and clears when they stop holding. Home Assistant can raise
 * alerts too, through the HEARTH event; those are not configured here.
 */
export interface AlertRule {
	id: string;
	title: string;
	message?: string;
	icon?: string;
	severity: AlertSeverity;
	conditions: VisibilityCondition[];
	for_seconds?: number;
	// unset means true: the alert pops up over the dashboard, not only in the
	// notifications widget
	popup?: boolean;
	// unset means true: the alert and its popup go away once the conditions
	// stop holding; false keeps it until someone dismisses it
	auto_close?: boolean;
	// pops up this entity's detail popup instead of an alert card
	entity?: string;
	// unset plays the chime alert_chimes sets for the severity, if any
	chime?: AlertChime;
}

export type EditLock = 'hold' | 'pin';

export type ScreensaverBackground = 'none' | 'image' | 'radar' | 'photos' | 'sun' | 'media';
/** What a `media` sleep screen shows behind the clock while nothing plays. */
export type ScreensaverMediaFallback = Exclude<ScreensaverBackground, 'media'>;
export type ScreensaverPhotoOrder = 'shuffle' | 'sequence';
export type ScreensaverClockSize = 'small' | 'medium' | 'large';

/** The radar map's view; the location falls back to the Home Assistant home. */
export interface ScreensaverRadar {
	latitude?: number;
	longitude?: number;
	zoom?: number;
	basemap?: 'dark' | 'light';
	/** Leaflet tile URL template replacing the OpenStreetMap basemap. */
	tile_url?: string;
	/** Plain-text credit for tile_url's provider. */
	attribution?: string;
}

export interface HearthConfig {
	theme?: HearthTheme;
	// full replacement for theme while day_night resolves to night
	theme_night?: HearthTheme;
	day_night?: DayNightSwitch;
	theme_schedule?: ThemeScheduleEntry[];
	// unset is a single rail on the left
	rail_position?: RailPosition;
	rail: RailWidget[];
	// every page, Home included; the first one is where the dashboard opens
	rooms: HearthRoom[];
	// display options for wall tablets; screensaver off when unset
	screensaver_minutes?: number;
	screensaver_drift?: boolean;
	/** Clock brightness from 10 to 100 percent. */
	screensaver_brightness?: number;
	// what fills the screen behind the clock; plain black when unset
	screensaver_background?: ScreensaverBackground;
	/** A URL or `hearth-images/<file>`, shown when the background is `image`. */
	screensaver_image?: string;
	screensaver_radar?: ScreensaverRadar;
	/** Uploaded images (`hearth-images/<file>`) the `photos` background steps through. */
	screensaver_photos?: string[];
	/** Seconds per photo, 30 when unset. */
	screensaver_photo_seconds?: number;
	// unset shuffles
	screensaver_photo_order?: ScreensaverPhotoOrder;
	// the `media` background follows this player, or any playing one when unset
	screensaver_media_entity?: string;
	screensaver_media_fallback?: ScreensaverMediaFallback;
	screensaver_show_date?: boolean;
	screensaver_clock_size?: ScreensaverClockSize;
	/** Weather entity whose condition and temperature show under the clock. */
	screensaver_weather_entity?: string;
	keep_screen_on?: boolean;
	// what the edit toggle asks for before edit mode, against accidental taps
	// on a wall tablet; a pin without a valid edit_pin falls back to a hold
	edit_lock?: EditLock;
	/** 4 to 8 digits, asked for when edit_lock is `pin`. */
	edit_pin?: string;
	// progressive blur where a scroll container cuts content off; costs a
	// backdrop pass per layer, so weak tablets can turn it off
	scroll_edge_blur?: boolean;
	// tile icons that move with their entity, such as a spinning fan; reduced
	// motion stops them whatever this says
	animations?: boolean;
	// a sideways swipe over the page moves to the next or previous page,
	// set apart for the folded (phone) and wide layouts
	swipe_navigation_mobile?: boolean;
	swipe_navigation_desktop?: boolean;
	// a small time and date at the start of the phone page strip
	phone_clock?: boolean;
	// extra edge padding in px, for kiosks whose frame covers screen edges
	padding_x?: number;
	padding_y?: number;
	// phone-width overrides for the two paddings; the plain values apply when unset
	mobile_padding_x?: number;
	mobile_padding_y?: number;
	/** Whole-interface zoom in percent, 50 to 200; the mobile value applies on phone-width screens. */
	scale?: number;
	mobile_scale?: number;
	alerts?: AlertRule[];
	alert_chimes?: AlertChimes;
	greeting?: PresenceGreeting;
}
