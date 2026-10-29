<script module lang="ts">
	import type { HearthConfig } from '../../config';

	/** The dashboard keys this section's own rows change. */
	export const SETTING_KEYS = [
		'scroll_edge_blur',
		'animations'
	] as const satisfies readonly (keyof HearthConfig)[];
</script>

<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { hearthConfig, updateConfig } from '../../store';
	import SettingsRow from '../SettingsRow.svelte';
	import Switch from '../../Switch.svelte';
	import { editorOpener } from './opener';
	import SettingsSection from './SettingsSection.svelte';

	const openEditor = editorOpener();

	let scrollEdgeBlur = $derived($hearthConfig.scroll_edge_blur ?? true);
	let animations = $derived($hearthConfig.animations ?? true);

	function setScrollEdgeBlur(enabled: boolean) {
		updateConfig((config) => {
			config.scroll_edge_blur = enabled ? undefined : false;
		});
	}

	function setAnimations(enabled: boolean) {
		updateConfig((config) => {
			config.animations = enabled ? undefined : false;
		});
	}
</script>

<SettingsSection id="appearance" title={$lang('hearth_appearance')} scope="dashboard">
	<SettingsRow
		icon="palette"
		label={$lang('theme')}
		sub={$lang('hearth_theme_row_sub')}
		onclick={() => openEditor({ kind: 'theme' })}
	/>
	<SettingsRow
		icon="css"
		label={$lang('hearth_custom_css')}
		sub={$lang('hearth_custom_css_sub')}
		onclick={() => openEditor({ kind: 'customCss' })}
	/>
	<SettingsRow
		label={$lang('hearth_scroll_edge_blur')}
		sub={$lang('hearth_blurs_content_where_a_list_runs_off')}
	>
		<Switch
			checked={scrollEdgeBlur}
			label={$lang('hearth_scroll_edge_blur')}
			onchange={setScrollEdgeBlur}
		/>
	</SettingsRow>
	<SettingsRow label={$lang('hearth_tile_animations')} sub={$lang('hearth_tile_animations_sub')}>
		<Switch checked={animations} label={$lang('hearth_tile_animations')} onchange={setAnimations} />
	</SettingsRow>
</SettingsSection>
