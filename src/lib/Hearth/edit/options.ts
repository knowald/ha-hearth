import { fill } from '$lib/core/i18n';

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
