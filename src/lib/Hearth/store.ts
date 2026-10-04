import { derived, get, writable } from 'svelte/store';
import { base } from '$app/paths';
import { validTimeZone } from './clock';
import type { SliderUpdateMode } from '$lib/core/app/configuration';
import { vibrate } from '$lib/core/app/haptics';
import { holdReloads, reloadPage } from '$lib/core/app/reload';
import { lang } from '$lib/core/i18n';
import {
	DEFAULT_HEARTH_CONFIG,
	type AlertSeverity,
	type HearthConfig,
	type RailSide
} from './config';

/* configuration */

export const hearthConfig = writable<HearthConfig>(structuredClone(DEFAULT_HEARTH_CONFIG));

// Non-null when the source file exists but could not be parsed/read. Editing
// stays locked so fallback rendering can never overwrite that source.
export const hearthLoadError = writable<string | null>(null);

/** Which of the server's failure paths produced hearthLoadError. */
export type HearthErrorKind = 'unreadable' | 'version' | 'invalid';
export const hearthLoadErrorKind = writable<HearthErrorKind | null>(null);

// True only when the server found no usable source document. The dashboard
// can offer discovery automatically without confusing parse/I/O failures with
// a first run.
export const hearthNeedsSetup = writable(false);

// Non-null when configuration.yaml exists but could not be read; the server
// then runs on default application settings.
export const configurationLoadError = writable<string | null>(null);

export const setupWizardOpen = writable(false);
/** What the setup wizard opens on: the area import or the starter layouts. */
export const setupWizardSource = writable<'areas' | 'starter'>('areas');

// shows the sleep screen at once, even with the idle timeout off
export const screensaverPreview = writable(false);

// true while the sleep screen covers the dashboard, previews included
export const screensaverActive = writable(false);

// server-managed save counter for conflict detection between tabs
export const hearthRevision = writable(0);

const undoStack: HearthConfig[] = [];
const redoStack: HearthConfig[] = [];

export const canUndo = writable(false);
export const canRedo = writable(false);

function syncHistoryFlags() {
	canUndo.set(undoStack.length > 0);
	canRedo.set(redoStack.length > 0);
}

export function updateConfig(mutate: (config: HearthConfig) => void) {
	hearthConfig.update((config) => {
		undoStack.push(config);
		if (undoStack.length > 50) undoStack.shift();
		redoStack.length = 0;
		const next = structuredClone(config);
		mutate(next);
		return next;
	});
	syncHistoryFlags();
}

export function undoConfig() {
	const previous = undoStack.pop();
	if (!previous) return;
	redoStack.push(get(hearthConfig));
	hearthConfig.set(previous);
	syncHistoryFlags();
}

export function redoConfig() {
	const next = redoStack.pop();
	if (!next) return;
	undoStack.push(get(hearthConfig));
	hearthConfig.set(next);
	syncHistoryFlags();
}

/*
 * A removal is undone from its toast rather than confirmed first. The offer
 * holds the config the removal produced, and Undo only steps back while that
 * is still the current one: any later change ends the offer, so the toast
 * can never undo something other than the removal it names.
 */
export const UNDO_OFFER_MS = 6000;
/** `serial` tells two offers with the same message apart, so each is announced. */
export const undoOffer = writable<{ message: string; serial: number } | null>(null);
let undoTarget: HearthConfig | null = null;
let undoTimer: ReturnType<typeof setTimeout> | undefined;
let undoSerial = 0;

export function offerUndo(message: string) {
	undoTarget = get(hearthConfig);
	undoSerial += 1;
	undoOffer.set({ message, serial: undoSerial });
	resumeUndoOffer();
}

/** Holds the offer while the pointer or focus is on its toast. */
export function pauseUndoOffer() {
	clearTimeout(undoTimer);
}

/** Gives a held offer its full time again, so it never vanishes under a leaving pointer. */
export function resumeUndoOffer() {
	clearTimeout(undoTimer);
	if (undoTarget) undoTimer = setTimeout(dismissUndoOffer, UNDO_OFFER_MS);
}

export function dismissUndoOffer() {
	clearTimeout(undoTimer);
	undoTarget = null;
	undoOffer.set(null);
}

export function acceptUndoOffer() {
	if (undoTarget && get(hearthConfig) === undoTarget) undoConfig();
	dismissUndoOffer();
}

hearthConfig.subscribe((config) => {
	if (undoTarget && config !== undoTarget) dismissUndoOffer();
});

/* edit mode */

export const hearthEditMode = writable(false);

hearthEditMode.subscribe((editing) => {
	if (!editing) dismissUndoOffer();
});

// a reload Home Assistant asks for mid-edit would drop the draft, so it waits for Save or Cancel
hearthEditMode.subscribe(holdReloads);

// edit mode arranges layout; taps there must never fire real device commands

export type Editor =
	| { kind: 'room'; id: string | null }
	// Existing cards are addressed by their globally unique id. Column/stack
	// identify only the insertion destination for a new card.
	| { kind: 'card'; roomId: string; id: string | null; column?: number; stackId?: string }
	// a null index is a new stack, appended to the column on Done
	| { kind: 'stack'; roomId: string; column: number; index: number | null }
	// side is the rail a new widget was added from, while there are two
	| { kind: 'railWidget'; index: number | null; side?: RailSide }
	| { kind: 'theme' }
	| { kind: 'settings' }
	// a null index is a new alert rule, appended on Done
	| { kind: 'alert'; index: number | null }
	| { kind: 'appSettings' }
	| { kind: 'customCss' }
	// `from` is the sheet a back arrow returns to, in the state it was left in.
	// `draft` is an unapplied YAML edit handed back from Versions; the editor
	// closing is what discards it
	| { kind: 'code'; draft?: string; from?: Editor }
	| { kind: 'versions'; from?: Editor };

export const editor = writable<Editor | null>(null);

// the next editor is the next piece of work; the removal's toast is behind it
editor.subscribe((open) => {
	if (open) dismissUndoOffer();
});

// The dashboard previews this slot while the theme editor is open.
export const editedThemeSlot = writable<'day' | 'night'>('day');

let editSnapshot: HearthConfig | null = null;
// an import in the session clears the first-run state, which Cancel brings back
let setupSnapshot = false;

/** What the dashboard was before a change that was applied outside edit mode. */
export interface UnsavedChange {
	config: HearthConfig;
	needsSetup: boolean;
}

/**
 * `unsaved` hands over a change that was applied and failed to save outside
 * edit mode: Cancel returns to what came before it, and the failure stays on
 * the bar.
 */
export function enterEditMode(unsaved?: UnsavedChange) {
	editSnapshot = structuredClone(unsaved?.config ?? get(hearthConfig));
	setupSnapshot = unsaved?.needsSetup ?? get(hearthNeedsSetup);
	undoStack.length = 0;
	redoStack.length = 0;
	syncHistoryFlags();
	if (!unsaved) clearSaveFeedback();
	hearthEditMode.set(true);
}

export function cancelEdit() {
	if (editSnapshot) {
		hearthConfig.set(editSnapshot);
		hearthNeedsSetup.set(setupSnapshot);
	}
	editSnapshot = null;
	undoStack.length = 0;
	redoStack.length = 0;
	syncHistoryFlags();
	clearSaveFeedback();
	editor.set(null);
	hearthEditMode.set(false);
}

/** The edit bar's Cancel: at once when nothing changed, otherwise once the user agrees to drop the edits. */
export function requestCancelEdit() {
	if (!hasUnsavedEdits()) {
		cancelEdit();
		return;
	}
	const text = get(lang);
	requestConfirmation({
		title: text('hearth_discard_edits_title'),
		message: text('hearth_discard_edits_message'),
		confirmLabel: text('hearth_discard'),
		action: cancelEdit
	});
}

/** The revision the server holds now, or undefined when it cannot say. */
export async function fetchServerRevision(): Promise<number | undefined> {
	try {
		// a slow server must not keep the editor from opening
		const response = await fetch(`${base}/_api/hearth_versions`, {
			cache: 'no-store',
			signal: AbortSignal.timeout(3000)
		});
		if (!response.ok) return undefined;
		const { revision } = await response.json();
		return Number.isInteger(revision) ? revision : undefined;
	} catch {
		return undefined;
	}
}

/** True when the draft differs from what edit mode started with or last saved. */
export function hasUnsavedEdits(): boolean {
	return (
		editSnapshot !== null && JSON.stringify(get(hearthConfig)) !== JSON.stringify(editSnapshot)
	);
}

export const saveState = writable<'idle' | 'saved' | 'conflict' | 'error'>('idle');
saveState.subscribe((state) => {
	if (state === 'saved') vibrate('success');
	else if (state === 'conflict' || state === 'error') vibrate('error');
});
/** Why the last save failed, from the server when it said. */
export const saveFailure = writable<string | null>(null);
let savedToastTimer: ReturnType<typeof setTimeout>;

// an old failure or conflict belongs to the session that hit it
function clearSaveFeedback() {
	clearTimeout(savedToastTimer);
	saveState.set('idle');
	saveFailure.set(null);
}

let unloadAllowed = false;
// an editor sheet holding typed changes that Done has not applied yet
let sheetChanges = false;

export function reportSheetChanges(dirty: boolean) {
	sheetChanges = dirty;
}

/** beforeunload handler: the browser asks before a reload or a close drops unsaved edits. */
export function guardUnload(event: BeforeUnloadEvent) {
	if (unloadAllowed || !(sheetChanges || hasUnsavedEdits())) return;
	event.preventDefault();
	// older WebViews on wall tablets only ask when returnValue is set
	event.returnValue = '';
}

/** Reload once the user agreed to drop the edits, without the browser asking again. */
export function reloadDiscardingEdits() {
	unloadAllowed = true;
	void reloadPage();
}

/** Save and surface the outcome through saveState instead of throwing. */
export async function saveWithFeedback(force = false): Promise<void> {
	saveState.set('idle');
	saveFailure.set(null);
	try {
		await saveEdit(force);
	} catch (error) {
		console.error(error);
		saveFailure.set(error instanceof Error ? error.message : String(error));
		saveState.set('error');
	}
}

/** Outcome of the edit bar's Copy edits, kept apart from saveState since nothing is saved. */
export const copyState = writable<'idle' | 'copied' | 'failed'>('idle');
let copyToastTimer: ReturnType<typeof setTimeout>;

export function reportCopy(outcome: 'copied' | 'failed') {
	copyState.set(outcome);
	vibrate(outcome === 'copied' ? 'success' : 'error');
	clearTimeout(copyToastTimer);
	copyToastTimer = setTimeout(() => copyState.set('idle'), 2500);
}

let saveInFlight: Promise<boolean> | null = null;

/** Returns false on a revision conflict (another tab saved first). */
export function saveEdit(force = false): Promise<boolean> {
	// a second save while one is in flight would race its feedback and could
	// clear history for edits it never sent, so it shares the first request
	if (!saveInFlight) {
		saveInFlight = performSave(force).finally(() => {
			saveInFlight = null;
		});
	}
	return saveInFlight;
}

async function performSave(force: boolean): Promise<boolean> {
	const loadError = get(hearthLoadError);
	if (loadError) {
		saveState.set('error');
		throw new Error(`Cannot save an unreadable Hearth configuration: ${loadError}`);
	}
	const config = get(hearthConfig);
	const response = await fetch(`${base}/_api/save_hearth`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ revision: get(hearthRevision), config, force })
	});
	if (response.status === 409) {
		// keep the stale revision: a plain retry must conflict again, only the
		// explicit overwrite (force) may replace the other tab's save
		saveState.set('conflict');
		return false;
	}
	if (!response.ok) {
		saveState.set('error');
		const detail = (await response.text().catch(() => '')).trim();
		throw new Error(detail || `save failed with status ${response.status}`);
	}
	const { revision } = await response.json();
	hearthRevision.set(revision);
	// the file now holds a dashboard, so this is no longer a first run
	hearthNeedsSetup.set(false);
	saveState.set('saved');
	clearTimeout(savedToastTimer);
	savedToastTimer = setTimeout(() => saveState.set('idle'), 2500);
	if (get(hearthConfig) !== config) {
		// edits landed while the request was in flight; they are still unsaved,
		// so the editor stays open with its history and Cancel now returns to
		// what was just saved
		editSnapshot = config;
		setupSnapshot = false;
		return true;
	}
	editSnapshot = null;
	undoStack.length = 0;
	redoStack.length = 0;
	syncHistoryFlags();
	editor.set(null);
	hearthEditMode.set(false);
	return true;
}

/** The first clock widget in the rail, whose zone and hour format other surfaces follow. */
export const railClock = derived(hearthConfig, ($config) =>
	$config.rail.find((widget) => widget.type === 'clock')
);

/**
 * The zone times are shown in: the rail clock's configured zone when it has
 * one, else the browser's. Every surface that formats a wall-clock time
 * (clock, screensaver, calendar, phone strip) reads it here.
 */
export const displayTimeZone = derived(railClock, ($clock) => validTimeZone($clock?.timezone));

/* navigation & popups */

export const currentRoom = writable<string>('home');

/** This browser's favorites page is on screen in place of the current page; see favorites.ts. */
export const favoritesOpen = writable(false);

/**
 * Shows a page, leaving the favorites page. Setting currentRoom alone would
 * not, when the page asked for is the one the favorites page covers.
 */
export function goToPage(id: string) {
	favoritesOpen.set(false);
	currentRoom.set(id);
}

export type Popup = {
	kind: 'light' | 'blind' | 'fan' | 'media' | 'detail';
	entity: string;
	name: string;
	/** the opening tile's configured icon, shown in the popup header */
	icon?: string;
	sliderUpdates?: SliderUpdateMode;
	readonly?: boolean;
};

export const popup = writable<Popup | null>(null);

export interface RequestedConfirmation {
	title: string;
	message: string;
	confirmLabel: string;
	action: () => void;
	/** Names the cancel button when it does more than dismiss. */
	cancelLabel?: string;
	/**
	 * Runs from the cancel button only. Escape, back and a backdrop tap just
	 * dismiss, so a stray one never picks this choice for the user.
	 */
	cancel?: () => void;
}

export const requestedConfirmation = writable<RequestedConfirmation | null>(null);

/** Replaces any request still open; the replaced one is dismissed without running either choice. */
export function requestConfirmation(request: RequestedConfirmation) {
	requestedConfirmation.set(null);
	requestedConfirmation.set(request);
}

export function dismissConfirmation() {
	requestedConfirmation.set(null);
}

/** The dialog's cancel button: dismiss, then run the request's own cancel choice. */
export function cancelRequestedAction() {
	const request = get(requestedConfirmation);
	requestedConfirmation.set(null);
	request?.cancel?.();
}

export function confirmRequestedAction() {
	const request = get(requestedConfirmation);
	requestedConfirmation.set(null);
	request?.action();
}

export function closePopup() {
	popup.set(null);
}

/*
 * Bumped when something that needs to be seen appears on its own, such as an
 * alert; the screensaver steps aside for it. A counter, so every request
 * reaches subscribers even when two arrive back to back.
 */
export const wakeScreen = writable(0);

export function requestWake() {
	wakeScreen.update((count) => count + 1);
}

/* alerts */

/*
 * What the dashboard shows of its alerts. The engine that raises and clears
 * them (alertEngine.ts) loads after the dashboard mounts; the rail only needs
 * these stores to draw its count.
 */

export interface HearthAlert {
	/** `rule:<id>` for a configured rule, `event:<tag>` for a Home Assistant event. */
	key: string;
	title: string;
	message?: string;
	icon?: string;
	severity: AlertSeverity;
	/** Shown as a card over the dashboard, not only in the list. */
	popup: boolean;
	/** An entity the alert is about; the card offers to open it. */
	entity?: string;
	since: number;
}

/** Raised alerts nobody has dismissed on this screen, newest first. */
export const activeAlerts = writable<HearthAlert[]>([]);

export const alertListOpen = writable(false);

const SEVERITY_ICONS: Record<AlertSeverity, string> = {
	info: 'info',
	warning: 'warning',
	critical: 'error'
};

export function alertIcon(alert: Pick<HearthAlert, 'icon' | 'severity'>): string {
	return alert.icon || SEVERITY_ICONS[alert.severity];
}
