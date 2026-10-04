import { fill } from '$lib/core/i18n';
import type { AlertChime } from '../types';
import { THEME_PRESETS } from '$lib/core/theme';

export interface Option {
	value: string;
	label: string;
}

type Translate = (key: string) => string;

/**
 * A select only shows a value it has an option for. hearth.yaml can hold any
 * value its schema allows, so one off the preset list gets an option of its
 * own instead of the select silently showing the first preset.
 */
export function withCurrent(
	options: Option[],
	value: string,
	lang: Translate,
	shown = value
): Option[] {
	if (value === '' || options.some((option) => option.value === value)) return options;
	return [...options, { value, label: fill(lang('hearth_custom_value'), { value: shown }) }];
}

/** Sleep screen delays in minutes; 0 is off. */
export function sleepOptions(lang: Translate): Option[] {
	return [
		{ value: '0', label: lang('off') },
		{ value: '1', label: lang('hearth_after_1_minute') },
		{ value: '5', label: lang('hearth_after_5_minutes') },
		{ value: '10', label: lang('hearth_after_10_minutes') },
		{ value: '15', label: lang('hearth_after_15_minutes') },
		{ value: '30', label: lang('hearth_after_30_minutes') },
		{ value: '60', label: lang('hearth_after_1_hour') }
	];
}

/** The tones an alert can chime with, `none` first. */
export function chimeOptions(lang: Translate): Option[] {
	return [
		{ value: 'none', label: lang('hearth_chime_none') },
		{ value: 'chime', label: lang('hearth_chime_chime') },
		{ value: 'soft', label: lang('hearth_chime_soft') },
		{ value: 'bell', label: lang('hearth_chime_bell') }
	];
}

/** A stored chime as a select value: '' when unset and `chime` for true. */
export function chimeValue(chime: AlertChime | undefined): string {
	return chime === undefined ? '' : chime === true ? 'chime' : chime;
}

/** The reverse of chimeValue. */
export function storedChime(value: string): AlertChime | undefined {
	if (value === 'chime') return true;
	return value === 'soft' || value === 'bell' || value === 'none' ? value : undefined;
}

/** Built-in presets by id, then saved themes by name: the ways a page or schedule names a theme. */
export function themeOptions(lang: Translate, saved: { name: string }[] = []): Option[] {
	return [
		...THEME_PRESETS.map((preset) => ({
			value: preset.id,
			label: lang(`hearth_theme_preset_${preset.id}`)
		})),
		...saved
			.filter((theme) => !THEME_PRESETS.some((preset) => preset.id === theme.name))
			.map((theme) => ({ value: theme.name, label: theme.name }))
	];
}
