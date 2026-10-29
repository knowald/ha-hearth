<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { editor } from '../store';
	import EditSheet from './EditSheet.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import { screenSheetOpen } from '../screen';
	import AlertsSection from './settings/AlertsSection.svelte';
	import AppearanceSection from './settings/AppearanceSection.svelte';
	import LayoutSection from './settings/LayoutSection.svelte';
	import PagesSection from './settings/PagesSection.svelte';
	import SettingsSection from './settings/SettingsSection.svelte';
	import SizeSection from './settings/SizeSection.svelte';
	import WallDisplaySection from './settings/WallDisplaySection.svelte';

	function close() {
		editor.set(null);
	}
</script>

<!-- every row applies as it changes, so the header action only closes -->
<EditSheet
	title={$lang('settings')}
	onclose={close}
	ondone={close}
	doneLabel={$lang('hearth_close')}
>
	<div class="settings">
		<div class="settings-note">{$lang('hearth_settings_note')}</div>

		<SettingsSection title={$lang('hearth_this_screen')} scope={$lang('hearth_scope_this_browser')}>
			<SettingsRow
				icon="display_settings"
				label={$lang('hearth_this_screen')}
				sub={$lang('hearth_this_screen_sub')}
				onclick={() => screenSheetOpen.set(true)}
			/>
		</SettingsSection>

		<AppearanceSection />
		<LayoutSection />
		<SizeSection />
		<WallDisplaySection />
		<AlertsSection />
		<PagesSection />

		<SettingsSection title={$lang('hearth_server')} scope={$lang('hearth_scope_saved_now')}>
			<SettingsRow
				icon="dns"
				label={$lang('hearth_server_settings')}
				sub={$lang('hearth_server_settings_sub')}
				onclick={() => editor.set({ kind: 'appSettings' })}
			/>
		</SettingsSection>

		<SettingsSection title={$lang('hearth_maintenance')}>
			<SettingsRow
				icon="code"
				label={$lang('hearth_edit_configuration_yaml')}
				sub={$lang('hearth_edits_the_whole_configuration_as_yaml')}
				onclick={() => editor.set({ kind: 'code', from: { kind: 'settings' } })}
			/>
			<SettingsRow
				icon="history"
				label={$lang('hearth_versions')}
				sub={$lang('hearth_versions_row_sub')}
				onclick={() => editor.set({ kind: 'versions', from: { kind: 'settings' } })}
			/>
		</SettingsSection>
	</div>
</EditSheet>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 560px;
		margin: 0 auto;
		width: 100%;
	}

	.settings-note {
		font-size: var(--h-type-small);
		color: var(--h-text-6);
		margin: 0 0 8px;
	}
</style>
