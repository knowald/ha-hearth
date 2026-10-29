<script module lang="ts">
	import type { HearthConfig } from '../../config';

	/** The dashboard keys this section's rows change. */
	export const SETTING_KEYS = [
		'rail_position',
		'swipe_navigation_mobile',
		'swipe_navigation_desktop',
		'phone_clock'
	] as const satisfies readonly (keyof HearthConfig)[];
</script>

<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { railPositionOf, type RailPosition } from '../../config';
	import { hearthConfig, updateConfig } from '../../store';
	import SelectField from '../SelectField.svelte';
	import SettingsRow from '../SettingsRow.svelte';
	import Switch from '../../Switch.svelte';
	import SettingsSection from './SettingsSection.svelte';

	let railPosition = $derived(railPositionOf($hearthConfig));
	let swipeMobile = $derived($hearthConfig.swipe_navigation_mobile ?? false);
	let swipeDesktop = $derived($hearthConfig.swipe_navigation_desktop ?? false);
	let phoneClock = $derived($hearthConfig.phone_clock ?? false);

	let RAIL_POSITION_OPTIONS = $derived([
		{ value: 'left', label: $lang('hearth_sidebar_left') },
		{ value: 'right', label: $lang('hearth_sidebar_right') },
		{ value: 'both', label: $lang('hearth_sidebar_both') },
		{ value: 'none', label: $lang('hearth_sidebar_none') }
	]);

	function setRailPosition(value: string) {
		updateConfig((config) => {
			config.rail_position = value === 'left' ? undefined : (value as RailPosition);
		});
	}

	function setSwipe(key: 'swipe_navigation_mobile' | 'swipe_navigation_desktop', enabled: boolean) {
		updateConfig((config) => {
			config[key] = enabled ? true : undefined;
		});
	}

	function setPhoneClock(enabled: boolean) {
		updateConfig((config) => {
			config.phone_clock = enabled ? true : undefined;
		});
	}
</script>

<SettingsSection
	title={$lang('hearth_layout_and_navigation')}
	scope={$lang('hearth_scope_dashboard')}
>
	<SettingsRow
		label={$lang('hearth_sidebar')}
		sub={$lang(
			railPosition === 'none'
				? 'hearth_sidebar_widgets_hidden_but_kept'
				: 'hearth_where_widgets_sit_on_wide_screens'
		)}
	>
		<SelectField
			inline
			label={$lang('hearth_sidebar')}
			value={railPosition}
			options={RAIL_POSITION_OPTIONS}
			onchange={setRailPosition}
		/>
	</SettingsRow>
	<SettingsRow
		label={$lang('hearth_swipe_between_pages_on_phones')}
		sub={$lang('hearth_swipe_sideways_over_the_page')}
	>
		<Switch
			checked={swipeMobile}
			label={$lang('hearth_swipe_between_pages_on_phones')}
			onchange={(enabled) => setSwipe('swipe_navigation_mobile', enabled)}
		/>
	</SettingsRow>
	<SettingsRow
		label={$lang('hearth_swipe_between_pages_on_wide_screens')}
		sub={$lang('hearth_drag_sideways_over_the_page')}
	>
		<Switch
			checked={swipeDesktop}
			label={$lang('hearth_swipe_between_pages_on_wide_screens')}
			onchange={(enabled) => setSwipe('swipe_navigation_desktop', enabled)}
		/>
	</SettingsRow>
	<SettingsRow
		label={$lang('hearth_clock_in_the_phone_page_strip')}
		sub={$lang('hearth_shows_the_time_and_date_beside')}
	>
		<Switch
			checked={phoneClock}
			label={$lang('hearth_clock_in_the_phone_page_strip')}
			onchange={setPhoneClock}
		/>
	</SettingsRow>
</SettingsSection>
