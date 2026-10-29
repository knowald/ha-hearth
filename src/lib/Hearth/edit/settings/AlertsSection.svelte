<script module lang="ts">
	import type { HearthConfig } from '../../config';

	/** The dashboard keys this section's rows change, including the alert sheets it opens. */
	export const SETTING_KEYS = [
		'alerts',
		'alert_chimes'
	] as const satisfies readonly (keyof HearthConfig)[];
</script>

<script lang="ts">
	import { integerFromInput } from '../numbers';
	import { lang } from '$lib/core/i18n';
	import { screenOverrides } from '$lib/core/app/screen';
	import type { AlertChimes, AlertSeverity } from '../../config';
	import { editor, hearthConfig, updateConfig } from '../../store';
	import SelectField from '../SelectField.svelte';
	import SettingsRow from '../SettingsRow.svelte';
	import type { ChimeTone } from '../../chime';
	import { DEFAULT_CHIME_VOLUME } from '../../model/alerts';
	import { chimeOptions, chimeValue, storedChime, withCurrent } from '../options';
	import GroupTitle from './GroupTitle.svelte';
	import SettingsSection from './SettingsSection.svelte';

	let chimes = $derived($hearthConfig.alert_chimes ?? {});
	let chimeVolume = $derived(String(chimes.volume ?? DEFAULT_CHIME_VOLUME));
	let CHIME_SEVERITIES = $derived([
		{ severity: 'info', label: $lang('hearth_alert_chime_info') },
		{ severity: 'warning', label: $lang('hearth_alert_chime_warning') },
		{ severity: 'critical', label: $lang('hearth_alert_chime_critical') }
	] as const);
	let CHIME_OPTIONS = $derived(chimeOptions($lang));
	let VOLUME_OPTIONS = $derived(
		withCurrent(
			['20', '40', '60', '80', '100'].map((value) => ({ value, label: `${value}%` })),
			chimeVolume,
			$lang
		)
	);

	/** Applies a change to the alert chimes, dropping keys that are back at their default. */
	function setChimes(patch: Partial<AlertChimes>) {
		updateConfig((config) => {
			const next: AlertChimes = { ...config.alert_chimes, ...patch };
			if (next.volume === DEFAULT_CHIME_VOLUME) next.volume = undefined;
			const kept = Object.entries(next).filter(([, value]) => value !== undefined);
			config.alert_chimes = kept.length ? Object.fromEntries(kept) : undefined;
		});
	}

	function setSeverityChime(severity: AlertSeverity, value: string) {
		const chime = storedChime(value);
		setChimes({ [severity]: chime === 'none' ? undefined : chime });
	}

	// the tone of the most severe alert that chimes, so the test sounds like one
	let previewTone = $derived.by((): ChimeTone => {
		for (const severity of ['critical', 'warning', 'info'] as const) {
			const chime = chimes[severity];
			if (chime === true) return 'chime';
			if (chime === 'soft' || chime === 'bell') return chime;
		}
		return 'chime';
	});

	async function playTestChime() {
		const { previewChime } = await import('../../chimeGate');
		await previewChime(previewTone, Number(chimeVolume));
	}
</script>

<SettingsSection title={$lang('hearth_alerts')} scope={$lang('hearth_scope_dashboard')}>
	{#each $hearthConfig.alerts ?? [] as rule, index (rule.id)}
		<SettingsRow
			icon={rule.icon || 'notifications_active'}
			label={rule.title}
			sub={rule.message}
			onclick={() => editor.set({ kind: 'alert', index })}
		/>
	{/each}
	<SettingsRow
		icon="add"
		label={$lang('hearth_add_alert')}
		sub={$lang('hearth_alerts_sub')}
		onclick={() => editor.set({ kind: 'alert', index: null })}
	/>
	<GroupTitle title={$lang('hearth_alert_chimes')} />
	{#each CHIME_SEVERITIES as { severity, label } (severity)}
		<SettingsRow {label}>
			<SelectField
				inline
				{label}
				value={chimeValue(chimes[severity]) || 'none'}
				options={CHIME_OPTIONS}
				onchange={(value) => setSeverityChime(severity, value)}
			/>
		</SettingsRow>
	{/each}
	<SettingsRow label={$lang('hearth_alert_chime_volume')}>
		<SelectField
			inline
			label={$lang('hearth_alert_chime_volume')}
			value={chimeVolume}
			options={VOLUME_OPTIONS}
			onchange={(value) => setChimes({ volume: integerFromInput(value) })}
		/>
	</SettingsRow>
	<SettingsRow
		icon="volume_up"
		label={$lang('hearth_alert_chime_test')}
		sub={$lang(
			$screenOverrides.mute_chimes
				? 'hearth_alert_chime_muted_here'
				: 'hearth_alert_chime_first_tap'
		)}
		chevron={false}
		onclick={playTestChime}
	/>
</SettingsSection>
