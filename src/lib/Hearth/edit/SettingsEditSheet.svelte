<script lang="ts">
	import { integerFromInput } from './numbers';
	import { ICON } from '../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { editor, hearthConfig, setupWizardOpen, updateConfig } from '../store';
	import EditSheet from './EditSheet.svelte';
	import Icon from '../Icon.svelte';
	import SelectField from './SelectField.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import Switch from '../Switch.svelte';
	import { wakeLockState } from '../wakeLock';

	let screensaver = $derived(String($hearthConfig.screensaver_minutes ?? 0));
	let screensaverDrift = $derived($hearthConfig.screensaver_drift ?? false);
	let screensaverBrightness = $derived(String($hearthConfig.screensaver_brightness ?? 32));
	let keepScreenOn = $derived($hearthConfig.keep_screen_on ?? true);
	let scrollEdgeBlur = $derived($hearthConfig.scroll_edge_blur ?? true);
	let paddingX = $derived($hearthConfig.padding_x ?? 0);
	let paddingY = $derived($hearthConfig.padding_y ?? 0);

	let SCREENSAVER_OPTIONS = $derived([
		{ value: '0', label: $lang('off') },
		{ value: '1', label: $lang('hearth_after_1_minute') },
		{ value: '5', label: $lang('hearth_after_5_minutes') },
		{ value: '10', label: $lang('hearth_after_10_minutes') },
		{ value: '15', label: $lang('hearth_after_15_minutes') },
		{ value: '30', label: $lang('hearth_after_30_minutes') },
		{ value: '60', label: $lang('hearth_after_1_hour') }
	]);
	let SCREENSAVER_BRIGHTNESS_OPTIONS = $derived([
		{ value: '18', label: $lang('hearth_very_dim') },
		{ value: '32', label: $lang('hearth_dim') },
		{ value: '50', label: $lang('fan_speed_medium') },
		{ value: '75', label: $lang('hearth_bright') }
	]);

	function setScreensaver(value: string) {
		const minutes = integerFromInput(value);
		updateConfig((config) => {
			config.screensaver_minutes = minutes > 0 ? minutes : undefined;
		});
	}

	function setScreensaverDrift(enabled: boolean) {
		updateConfig((config) => {
			config.screensaver_drift = enabled ? true : undefined;
		});
	}

	function setScreensaverBrightness(value: string) {
		const brightness = integerFromInput(value);
		updateConfig((config) => {
			config.screensaver_brightness = brightness === 32 ? undefined : brightness;
		});
	}

	function setKeepScreenOn(enabled: boolean) {
		updateConfig((config) => {
			config.keep_screen_on = enabled ? undefined : false;
		});
	}

	function setScrollEdgeBlur(enabled: boolean) {
		updateConfig((config) => {
			config.scroll_edge_blur = enabled ? undefined : false;
		});
	}

	function setPadding(axis: 'padding_x' | 'padding_y', value: string) {
		const pixels = integerFromInput(value);
		updateConfig((config) => {
			config[axis] = Number.isFinite(pixels) && pixels > 0 ? Math.min(pixels, 300) : undefined;
		});
	}

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
		<section>
			<div class="section-title">{$lang('hearth_display_2')}</div>
			<div class="rows">
				<SettingsRow label={$lang('hearth_screensaver')}>
					<SelectField
						inline
						label={$lang('hearth_screensaver')}
						value={screensaver}
						options={SCREENSAVER_OPTIONS}
						onchange={setScreensaver}
					/>
				</SettingsRow>
				{#if screensaver !== '0'}
					<SettingsRow
						label={$lang('hearth_screensaver_drift')}
						sub={$lang('hearth_slowly_moves_the_clock_to_protect')}
					>
						<Switch
							checked={screensaverDrift}
							label={$lang('hearth_screensaver_drift')}
							onchange={setScreensaverDrift}
						/>
					</SettingsRow>
					<SettingsRow label={$lang('hearth_screensaver_brightness')}>
						<SelectField
							inline
							label={$lang('hearth_screensaver_brightness')}
							value={screensaverBrightness}
							options={SCREENSAVER_BRIGHTNESS_OPTIONS}
							onchange={setScreensaverBrightness}
						/>
					</SettingsRow>
				{/if}
				<SettingsRow
					label={$lang('hearth_keep_screen_awake')}
					sub={$lang('hearth_while_the_dashboard_is_open')}
				>
					<Switch
						checked={keepScreenOn}
						label={$lang('hearth_keep_screen_awake')}
						onchange={setKeepScreenOn}
					/>
				</SettingsRow>
				{#if keepScreenOn && ($wakeLockState === 'unsupported' || $wakeLockState === 'denied')}
					<div class="setting-warning" role="alert">
						<Icon name="warning" size={ICON.control} />
						<span>
							{#if $wakeLockState === 'unsupported'}
								{$lang('hearth_screen_wake_lock_is_unavailable_open')}
							{:else}
								{$lang('hearth_the_browser_denied_the_screen_wake')}
							{/if}
						</span>
					</div>
				{/if}
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
				<SettingsRow
					label={$lang('hearth_side_padding')}
					sub={$lang('hearth_for_screens_whose_frame_covers_the')}
				>
					<span class="unit-input">
						<span class="stepper field-frame">
							<button
								type="button"
								class="step"
								aria-label={`${$lang('hearth_decrease')} ${$lang('hearth_side_padding').toLowerCase()}`}
								onclick={() => setPadding('padding_x', String(paddingX - 4))}
							>
								<Icon name="remove" size={ICON.inline} />
							</button>
							<input
								type="number"
								aria-label={$lang('hearth_side_padding')}
								min="0"
								max="300"
								value={paddingX}
								onchange={(event) => setPadding('padding_x', event.currentTarget.value)}
							/>
							<button
								type="button"
								class="step"
								aria-label={`${$lang('hearth_increase')} ${$lang('hearth_side_padding').toLowerCase()}`}
								onclick={() => setPadding('padding_x', String(paddingX + 4))}
							>
								<Icon name="add" size={ICON.inline} />
							</button>
						</span>
						<span class="unit">px</span>
					</span>
				</SettingsRow>
				<SettingsRow label={$lang('hearth_top_bottom_padding')}>
					<span class="unit-input">
						<span class="stepper field-frame">
							<button
								type="button"
								class="step"
								aria-label={`${$lang('hearth_decrease')} ${$lang('hearth_top_bottom_padding').toLowerCase()}`}
								onclick={() => setPadding('padding_y', String(paddingY - 4))}
							>
								<Icon name="remove" size={ICON.inline} />
							</button>
							<input
								type="number"
								aria-label={$lang('hearth_top_bottom_padding')}
								min="0"
								max="300"
								value={paddingY}
								onchange={(event) => setPadding('padding_y', event.currentTarget.value)}
							/>
							<button
								type="button"
								class="step"
								aria-label={`${$lang('hearth_increase')} ${$lang('hearth_top_bottom_padding').toLowerCase()}`}
								onclick={() => setPadding('padding_y', String(paddingY + 4))}
							>
								<Icon name="add" size={ICON.inline} />
							</button>
						</span>
						<span class="unit">px</span>
					</span>
				</SettingsRow>
			</div>
		</section>

		<section>
			<div class="section-title">{$lang('hearth_advanced')}</div>
			<div class="rows">
				<SettingsRow
					icon="auto_awesome"
					label={$lang('hearth_setup')}
					sub={$lang('hearth_setup_row_sub')}
					onclick={() => setupWizardOpen.set(true)}
				/>
				<SettingsRow
					icon="settings_applications"
					label={$lang('hearth_application_settings')}
					sub={$lang('hearth_language_motion_add_ons_version_and')}
					onclick={() => editor.set({ kind: 'appSettings' })}
				/>
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
			</div>
		</section>
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

	.section-title {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
		color: var(--h-label);
		margin: 0 0 8px;
	}

	.rows {
		border-radius: var(--h-radius-sm);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		background: var(--h-track);
		overflow: hidden;
	}

	.unit-input {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: none;
	}

	.unit {
		font-size: var(--h-type-secondary);
		color: var(--h-text-6);
	}

	/* minus, value, plus in one bordered group; the native spinner is hidden */
	.stepper {
		display: flex;
		align-items: center;
		border-radius: var(--h-radius-xs);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
	}

	.stepper:focus-within {
		border-color: rgb(var(--h-accent-rgb) / calc(0.4 * var(--h-accent-scale)));
	}

	.step {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		background: none;
		color: var(--h-icon);
		cursor: pointer;
	}

	.step:hover {
		color: var(--h-accent-text);
	}

	.unit-input input {
		width: 48px;
		text-align: center;
		padding: 8px 0;
		border: 0;
		background: none;
		color: var(--h-text-2);
		font-family: inherit;
		font-size: var(--h-type-body);
		outline: none;
	}

	/* the native spinner paints white over the dark field and eats the padding */
	.unit-input input[type='number'] {
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.unit-input input::-webkit-outer-spin-button,
	.unit-input input::-webkit-inner-spin-button {
		appearance: none;
		margin: 0;
	}

	.setting-warning {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 10px 14px;
		border-top: 1px solid rgb(var(--h-bad-rgb) / calc(0.22 * var(--h-accent-scale)));
		background: rgb(var(--h-bad-rgb) / calc(0.06 * var(--h-accent-scale)));
		color: var(--h-bad-text);
		font-size: var(--h-type-small);
		line-height: 1.4;
	}
</style>
