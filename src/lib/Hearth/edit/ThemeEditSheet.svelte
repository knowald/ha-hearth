<script lang="ts">
	import LoadingState from '../LoadingState.svelte';
	import { ICON } from '../iconSizes';
	import { lang, fill } from '$lib/core/i18n';
	import { activateOnKeyboard } from '../interaction';
	import { base } from '$app/paths';
	import { get } from 'svelte/store';
	import {
		deriveAccent,
		deriveBackground,
		deriveBad,
		deriveCool,
		deriveRadii,
		deriveText,
		GLASS_THEME,
		isLightTheme,
		RADIUS_SCALES,
		SURFACE_BLUR_SCALES,
		TEXT_CONTRAST_SCALES,
		TEXT_SHADOW_SCALES,
		textContrastOf,
		THEME_DEFAULTS,
		THEME_PRESETS,
		themeValueIssue,
		usableThemeValue,
		type HearthTheme
	} from '$lib/core/theme';
	import {
		editedThemeSlot,
		editor,
		hearthConfig,
		reportCopy,
		requestConfirmation,
		updateConfig
	} from '../store';
	import { downloadText } from '$lib/ui/download';
	import { copyText } from '$lib/ui/clipboard';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from '../config';
	import { themeDocument, themeFileName, themeFromDocument } from '../snippets';
	import EditSheet from './EditSheet.svelte';
	import ColorField from './ColorField.svelte';
	import CopyFallback from './CopyFallback.svelte';
	import SnippetInput from './SnippetInput.svelte';
	import EntityField from './EntityField.svelte';
	import ImageField from './ImageField.svelte';
	import SelectField from './SelectField.svelte';
	import TextField from './TextField.svelte';
	import { withCurrent } from './options';
	import Icon from '../Icon.svelte';

	interface SavedTheme {
		id: string;
		name: string;
		theme: HearthTheme;
	}

	let slot = $derived($editedThemeSlot);

	function slotTheme(
		config: { theme?: HearthTheme; theme_night?: HearthTheme },
		target: 'day' | 'night' = slot
	): HearthTheme {
		return (target === 'night' ? config.theme_night : config.theme) ?? {};
	}

	let theme = $derived(slotTheme($hearthConfig));
	let light = $derived(isLightTheme(theme));
	let nightEnabled = $derived(Boolean($hearthConfig.theme_night));

	function unwrapUrl(value?: string): string {
		if (!value || value === 'none') return '';
		const match = value.match(/^url\((.*)\)$/);
		return match ? match[1].replace(/^['"]|['"]$/g, '') : value;
	}

	let backgroundImageUrl = $state(unwrapUrl(slotTheme(get(hearthConfig)).background_image));

	/** Night is stored as a full theme, so its first edit starts from day. */
	function writeTheme(next: (current: HearthTheme) => HearthTheme | undefined) {
		updateConfig((config) => {
			if (slot === 'night') {
				config.theme_night = next(config.theme_night ?? { ...config.theme });
			} else {
				config.theme = next(config.theme ?? {});
			}
		});
	}

	let backgroundImageIssue = $derived.by(() => {
		const url = backgroundImageUrl.trim();
		return url ? themeValueIssue('background_image', `url(${url})`) : null;
	});

	// applied when the field is left rather than per keystroke: the dashboard
	// behind the window previews the new wallpaper without the undo stack
	// collecting a step for every character
	function applyBackgroundImage() {
		const url = backgroundImageUrl.trim();
		if (url === unwrapUrl(theme.background_image) || backgroundImageIssue) return;
		writeTheme((current) => {
			if (url) return { ...current, background_image: `url(${url})` };
			const next = { ...current };
			delete next.background_image;
			return next;
		});
	}

	function knob(key: string): string {
		return theme[key] ?? THEME_DEFAULTS[key] ?? '#000000';
	}

	function patchTheme(patch: HearthTheme) {
		writeTheme((current) => ({ ...current, ...patch }));
	}

	/** Sets one knob, dropping it again when the choice is its default. */
	function setKnob(key: string, value: string) {
		writeTheme((current) => {
			const next = { ...current, [key]: value };
			if (value === THEME_DEFAULTS[key]) delete next[key];
			return next;
		});
	}

	function applyPreset(preset: HearthTheme | null) {
		writeTheme(() =>
			preset ? { ...preset } : slot === 'night' ? { ...THEME_DEFAULTS } : undefined
		);
		backgroundImageUrl = preset ? unwrapUrl(preset.background_image) : '';
	}

	function selectSlot(next: 'day' | 'night') {
		if (next === slot) return;
		editedThemeSlot.set(next);
		backgroundImageUrl = unwrapUrl(slotTheme(get(hearthConfig), next).background_image);
	}

	let switchEntity = $state(get(hearthConfig).day_night?.entity ?? '');
	let nightState = $state(get(hearthConfig).day_night?.night_state ?? '');
	let switchFields = $state<HTMLElement>();

	// Typing reaches applySwitch through the bubbling change event, like the
	// background URL. The picker sets the value with no event of its own, so a
	// value that arrives while the field's own input is not focused applies here.
	function setSwitchEntity(next: string) {
		switchEntity = next;
		if (switchFields?.querySelector('input') !== document.activeElement) applySwitch();
	}

	function applySwitch() {
		const entity = switchEntity.trim();
		const state = nightState.trim();
		const current = get(hearthConfig).day_night;
		if (entity === (current?.entity ?? '') && state === (current?.night_state ?? '')) return;
		updateConfig((config) => {
			config.day_night = entity ? { entity, ...(state ? { night_state: state } : {}) } : undefined;
		});
	}

	function disableNightTheme() {
		updateConfig((config) => {
			config.theme_night = undefined;
		});
		selectSlot('day');
	}

	let savedThemes = $state<SavedTheme[]>([]);
	let themesLoading = $state(false);
	let themesError = $state('');
	let newThemeName = $state('');
	let saving = $state(false);

	async function loadThemes() {
		themesLoading = true;
		themesError = '';
		try {
			const response = await fetch(`${base}/_api/hearth_themes`);
			if (!response.ok) {
				themesError = `${$lang('hearth_themes_load_failed')} [${response.status}]`;
				return;
			}
			savedThemes = await response.json();
		} catch (err: any) {
			console.error(err);
			themesError = $lang('hearth_themes_load_failed');
		} finally {
			themesLoading = false;
		}
	}

	$effect(() => {
		loadThemes();
	});

	async function saveCurrentTheme() {
		const name = newThemeName.trim();
		if (!name || saving) return;
		saving = true;
		themesError = '';
		try {
			const response = await fetch(`${base}/_api/hearth_themes`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, theme })
			});
			if (!response.ok) {
				themesError = `${$lang('hearth_theme_save_failed')} [${response.status}]`;
				return;
			}
			newThemeName = '';
			await loadThemes();
		} catch (err: any) {
			console.error(err);
			themesError = $lang('hearth_theme_save_failed');
		} finally {
			saving = false;
		}
	}

	// a saved theme file is not checked when written, and the save endpoint
	// would refuse a value the dashboard cannot apply
	function applySavedTheme(saved: SavedTheme) {
		const usable = Object.entries(saved.theme).flatMap(([key, value]) => {
			const kept = typeof value === 'string' ? usableThemeValue(key, value) : null;
			return kept === null ? [] : [[key, kept]];
		});
		const next: HearthTheme = Object.fromEntries(usable);
		writeTheme(() => next);
		backgroundImageUrl = unwrapUrl(next.background_image);
	}

	function sameTheme(left: HearthTheme, right: HearthTheme) {
		const keys = Object.keys(left);
		return (
			keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key])
		);
	}

	/*
	 * Export and Import move a theme between dashboards as YAML, in the same
	 * shape the server keeps saved themes in. An import is checked and shown
	 * before it applies, and applies like a preset: one undoable step.
	 */
	let exportName = $derived(
		savedThemes.find((saved) => sameTheme(saved.theme, theme))?.name ??
			(newThemeName.trim() || $lang(slot === 'night' ? 'hearth_theme_night' : 'day'))
	);
	let importing = $state(false);
	let copyFallback = $state<string | null>(null);

	async function copyThemeYaml() {
		const text = themeDocument(exportName, theme);
		if (await copyText(text)) reportCopy('copied');
		else copyFallback = text;
	}

	function downloadTheme() {
		downloadText(themeFileName(exportName), themeDocument(exportName, theme));
	}

	function importTheme(text: string): string | null {
		const result = themeFromDocument(text);
		if (result.issue !== null) return result.issue;
		writeTheme(() => ({ ...result.value.theme }));
		backgroundImageUrl = unwrapUrl(result.value.theme.background_image);
		importing = false;
		return null;
	}

	function confirmDeleteSavedTheme(saved: SavedTheme) {
		requestConfirmation({
			title: fill($lang('hearth_delete_theme_confirm'), { name: saved.name }),
			message: $lang('hearth_delete_theme_message'),
			confirmLabel: $lang('delete'),
			action: () => void deleteSavedTheme(saved)
		});
	}

	async function deleteSavedTheme(saved: SavedTheme) {
		themesError = '';
		try {
			const response = await fetch(`${base}/_api/hearth_themes`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: saved.id })
			});
			if (!response.ok) {
				themesError = `${$lang('hearth_theme_delete_failed')} [${response.status}]`;
				return;
			}
			savedThemes = savedThemes.filter((entry) => entry.id !== saved.id);
		} catch (err: any) {
			console.error(err);
			themesError = $lang('hearth_theme_delete_failed');
		}
	}

	function swatch(saved: SavedTheme, key: string): string {
		return saved.theme[key] ?? THEME_DEFAULTS[key] ?? '#000000';
	}

	let radiusScale = $derived.by(() => {
		const current = parseInt(theme.radius_md ?? '18');
		return RADIUS_SCALES.reduce((nearest, scale) =>
			Math.abs(scale.factor * 18 - current) < Math.abs(nearest.factor * 18 - current)
				? scale
				: nearest
		).value;
	});

	// a theme may carry any backdrop-filter value; anything off the preset list
	// shows as the nearest named step rather than blanking the select
	let surfaceBlur = $derived.by(() => {
		const current = theme.surface_blur ?? THEME_DEFAULTS.surface_blur;
		const match = SURFACE_BLUR_SCALES.find((scale) => scale.blur === current);
		return (match ?? SURFACE_BLUR_SCALES[current === 'none' ? 0 : 2]).value;
	});

	// darkens a bright photo behind the panels; the medium step is the Glass preset's
	const LIGHT_SCRIM = 'linear-gradient(180deg, rgba(10, 8, 6, 0.15), rgba(10, 8, 6, 0.35))'; // copy ok: css value
	const STRONG_SCRIM = 'linear-gradient(180deg, rgba(10, 8, 6, 0.5), rgba(10, 8, 6, 0.8))'; // copy ok: css value
	const BACKGROUND_SCRIMS = [
		{ value: 'none', label: 'hearth_scrim_none' },
		{ value: LIGHT_SCRIM, label: 'hearth_scrim_light' },
		{ value: GLASS_THEME.background_scrim, label: 'hearth_scrim_medium' },
		{ value: STRONG_SCRIM, label: 'hearth_scrim_strong' }
	];
	let scrim = $derived(knob('background_scrim'));

	// the two bundled faces, plus ones every device already has
	const SYSTEM_FONT = 'system-ui, sans-serif'; // copy ok: css value
	const ROUNDED_FONT = "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif"; // copy ok: css value
	const SERIF_FONT = "ui-serif, Georgia, 'Times New Roman', serif"; // copy ok: css value
	const SYSTEM_MONO_FONT = 'ui-monospace, Menlo, Consolas, monospace'; // copy ok: css value
	const UI_FONTS = [
		{ value: THEME_DEFAULTS.font_ui, label: 'hearth_font_default' },
		{ value: SYSTEM_FONT, label: 'hearth_font_system' },
		{ value: ROUNDED_FONT, label: 'hearth_font_rounded' },
		{ value: SERIF_FONT, label: 'hearth_font_serif' },
		{ value: THEME_DEFAULTS.font_mono, label: 'hearth_font_mono' }
	];
	const MONO_FONTS = [
		{ value: THEME_DEFAULTS.font_mono, label: 'hearth_font_default' },
		{ value: SYSTEM_MONO_FONT, label: 'hearth_font_system_mono' },
		{ value: 'var(--h-font-ui)', label: 'hearth_font_same_as_text' }
	];

	// a font stack off the list shows by its first family
	function familyName(stack: string) {
		return stack
			.split(',')[0]
			.trim()
			.replace(/^['"]|['"]$/g, '');
	}

	let textContrast = $derived(textContrastOf(theme));
	let textFade = $derived(
		TEXT_CONTRAST_SCALES.find((scale) => scale.value === textContrast)?.fade ?? 1
	);

	let textShadow = $derived.by(() => {
		const current = theme.text_shadow ?? THEME_DEFAULTS.text_shadow;
		return (TEXT_SHADOW_SCALES.find((scale) => scale.shadow === current) ?? TEXT_SHADOW_SCALES[0])
			.value;
	});

	// every field applies live, so closing keeps a value still being typed
	// rather than dropping it; there is nothing staged for Done to commit
	function close() {
		applyBackgroundImage();
		applySwitch();
		editedThemeSlot.set('day');
		editor.set(null);
	}
</script>

{#snippet importPreview(text: string)}
	{@const shared = themeFromDocument(text).value}
	{#if shared}
		<div class="import-preview" aria-live="polite">
			<div class="dots">
				{#each ['background_inner', 'accent', 'cool', 'text_1'] as key (key)}
					<span class="dot" style:background={shared.theme[key] ?? THEME_DEFAULTS[key]}></span>
				{/each}
			</div>
			<span class="saved-theme-name">{shared.name ?? $lang('hearth_imported_theme')}</span>
			<span class="token-count">
				{fill(
					$lang(
						Object.keys(shared.theme).length === 1
							? 'hearth_theme_token_count_one'
							: 'hearth_theme_token_count'
					),
					{ count: Object.keys(shared.theme).length }
				)}
			</span>
		</div>
		{#if shared.ignored.length}
			<div class="field-hint">
				{fill($lang('hearth_theme_keys_left_out'), { keys: shared.ignored.join(', ') })}
			</div>
		{/if}
	{/if}
{/snippet}

<EditSheet
	title={$lang('theme')}
	onclose={close}
	ondone={close}
	doneLabel={$lang('hearth_close')}
	floating
>
	<div class="slots">
		<div
			class="slot pressable"
			class:active={slot === 'day'}
			onclick={() => selectSlot('day')}
			role="button"
			tabindex="0"
			onkeydown={(event) => activateOnKeyboard(event, () => selectSlot('day'))}
		>
			<Icon name="light_mode" size={ICON.control} />
			<span>{$lang('day')}</span>
		</div>
		<div
			class="slot pressable"
			class:active={slot === 'night'}
			onclick={() => selectSlot('night')}
			role="button"
			tabindex="0"
			onkeydown={(event) => activateOnKeyboard(event, () => selectSlot('night'))}
		>
			<Icon name="dark_mode" size={ICON.control} />
			<span>{$lang('hearth_theme_night')}</span>
			{#if !nightEnabled}<span class="slot-note">{$lang('hearth_off')}</span>{/if}
		</div>
	</div>

	<div class="field-hint">
		{#if slot === 'night'}
			{#if nightEnabled}
				{$lang('hearth_shown_while_the_switch_entity_reads')}
			{:else}
				{$lang('hearth_night_theme_is_off_its_first')}
			{/if}
		{:else}
			{$lang('hearth_the_default_theme_also_used_after')}
		{/if}
	</div>

	<div class="group-label">{$lang('hearth_day_night_switch')}</div>
	<div class="switch-fields" bind:this={switchFields} onchange={applySwitch}>
		<EntityField
			label={$lang('hearth_switch_entity')}
			bind:value={() => switchEntity, setSwitchEntity}
		/>
		<TextField
			label={$lang('hearth_night_states')}
			bind:value={nightState}
			placeholder="below_horizon"
			hint={$lang('hearth_comma_separated_when_empty_below_horizon')}
		/>
	</div>

	{#if nightEnabled}
		<div
			class="reset pressable"
			onclick={disableNightTheme}
			role="button"
			tabindex="0"
			onkeydown={(event) => activateOnKeyboard(event, disableNightTheme)}
		>
			{$lang('hearth_turn_off_the_night_theme')}
		</div>
	{/if}

	<div class="group-label">{$lang('hearth_presets')}</div>
	<div class="presets">
		{#each THEME_PRESETS as preset (preset.id)}
			<div
				class="preset pressable"
				onclick={() => applyPreset(preset.theme)}
				role="button"
				tabindex="0"
				onkeydown={(event) => activateOnKeyboard(event, () => applyPreset(preset.theme))}
			>
				<span
					class="preview"
					style:background="linear-gradient(135deg, {preset.theme?.background_inner ??
						THEME_DEFAULTS.background_inner} 55%, {preset.theme?.accent ?? THEME_DEFAULTS.accent})"
				></span>
				<span>{$lang(`hearth_theme_preset_${preset.id}`)}</span>
			</div>
		{/each}
	</div>

	<div class="group-label">{$lang('hearth_saved_themes')}</div>
	<div class="save-row">
		<input
			type="text"
			bind:value={newThemeName}
			placeholder={$lang('hearth_save_current_theme_as')}
			spellcheck="false"
			onkeydown={(event) => event.key === 'Enter' && saveCurrentTheme()}
		/>
		<button
			type="button"
			class="button pressable"
			disabled={!newThemeName.trim() || saving}
			onclick={saveCurrentTheme}
		>
			{$lang('save')}
		</button>
	</div>

	{#if themesError}
		<div class="error" role="alert">{themesError}</div>
	{/if}

	{#if themesLoading}
		<LoadingState inline text={$lang('hearth_loading_saved_themes')} />
	{:else if savedThemes.length}
		<div class="saved-themes">
			{#each savedThemes as saved (saved.id)}
				<div class="saved-theme">
					<button
						type="button"
						class="saved-theme-apply pressable"
						onclick={() => applySavedTheme(saved)}
					>
						<div class="dots">
							<span class="dot" style:background={swatch(saved, 'background_inner')}></span>
							<span class="dot" style:background={swatch(saved, 'accent')}></span>
							<span class="dot" style:background={swatch(saved, 'cool')}></span>
							<span class="dot" style:background={swatch(saved, 'text_1')}></span>
						</div>
						<span class="saved-theme-name">{saved.name}</span>
					</button>
					<button
						type="button"
						class="icon-button"
						aria-label={`${$lang('delete')} ${saved.name}`}
						onclick={() => confirmDeleteSavedTheme(saved)}
					>
						<Icon name="delete" size={ICON.control} />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<div class="field-hint">
		{$lang('hearth_saving_or_deleting_a_theme_writes')}
	</div>

	<div class="group-label">{$lang('hearth_share_theme')}</div>
	{#if importing}
		<SnippetInput
			label={$lang('hearth_theme_yaml')}
			hint={$lang('hearth_theme_import_hint')}
			submitLabel={$lang('hearth_apply')}
			accept=".yaml,.yml,text/yaml,application/yaml,application/x-yaml,text/plain"
			check={(text) => themeFromDocument(text).issue}
			preview={importPreview}
			onsubmit={importTheme}
			oncancel={() => (importing = false)}
		/>
	{:else}
		<div class="share-row">
			<button
				type="button"
				class="hearth-button secondary pressable"
				use:Ripple={PRESS_RIPPLE}
				onclick={copyThemeYaml}
			>
				<Icon name="content_copy" size={ICON.inline} />
				{$lang('hearth_copy_as_yaml')}
			</button>
			<button
				type="button"
				class="hearth-button secondary pressable"
				use:Ripple={PRESS_RIPPLE}
				onclick={downloadTheme}
			>
				<Icon name="download" size={ICON.inline} />
				{$lang('hearth_download')}
			</button>
			<button
				type="button"
				class="hearth-button secondary pressable"
				use:Ripple={PRESS_RIPPLE}
				onclick={() => {
					copyFallback = null;
					importing = true;
				}}
			>
				<Icon name="upload_file" size={ICON.inline} />
				{$lang('hearth_import')}
			</button>
		</div>
	{/if}
	{#if copyFallback !== null}
		<CopyFallback text={copyFallback} onclose={() => (copyFallback = null)} />
	{/if}

	<div class="group-label">{$lang('hearth_colors')}</div>
	<div class="picker-grid">
		<ColorField
			label={$lang('hearth_accent')}
			value={knob('accent')}
			onchange={(value) => patchTheme(deriveAccent(value, light))}
		/>
		<ColorField
			label={$lang('hearth_cool_accent')}
			value={knob('cool')}
			onchange={(value) => patchTheme(deriveCool(value, light))}
		/>
		<ColorField
			label={$lang('hearth_background_top')}
			value={knob('background_inner')}
			onchange={(value) => patchTheme(deriveBackground(value, knob('background_outer')))}
		/>
		<ColorField
			label={$lang('hearth_background_bottom')}
			value={knob('background_outer')}
			onchange={(value) => patchTheme(deriveBackground(knob('background_inner'), value))}
		/>
		<ColorField
			label={$lang('text')}
			value={knob('text_1')}
			onchange={(value) => patchTheme(deriveText(value, knob('background_outer'), light, textFade))}
		/>
		<ColorField
			label={$lang('hearth_muted_text')}
			value={knob('text_4')}
			onchange={(value) => patchTheme({ text_4: value, text_5: value, label: value })}
		/>
		<ColorField
			label={$lang('hearth_icons')}
			value={knob('icon')}
			onchange={(value) => patchTheme({ icon: value, icon_dim: value })}
		/>
		<ColorField
			label={$lang('hearth_good')}
			value={knob('good')}
			onchange={(value) => patchTheme({ good: value, good_text: value })}
		/>
		<ColorField
			label={$lang('hearth_alert')}
			value={knob('bad')}
			onchange={(value) => patchTheme(deriveBad(value, light))}
		/>
		<ColorField
			label={$lang('media')}
			value={knob('media')}
			onchange={(value) => patchTheme({ media: value })}
		/>
	</div>

	<ImageField
		label={$lang('hearth_background_image')}
		bind:value={backgroundImageUrl}
		issue={backgroundImageIssue}
		placeholder={$lang('hearth_example_background_image')}
		onchange={applyBackgroundImage}
	/>

	{#if theme.background_image && theme.background_image !== 'none'}
		<SelectField
			label={$lang('hearth_background_scrim')}
			value={scrim}
			options={withCurrent(
				BACKGROUND_SCRIMS.map(({ value, label }) => ({ value, label: $lang(label) })),
				scrim,
				$lang,
				$lang('hearth_custom_scrim')
			)}
			onchange={(value) => setKnob('background_scrim', value)}
		/>
	{/if}

	<SelectField
		label={$lang('hearth_font')}
		value={knob('font_ui')}
		options={withCurrent(
			UI_FONTS.map(({ value, label }) => ({ value, label: $lang(label) })),
			knob('font_ui'),
			$lang,
			familyName(knob('font_ui'))
		)}
		onchange={(value) => setKnob('font_ui', value)}
	/>

	<SelectField
		label={$lang('hearth_label_font')}
		value={knob('font_mono')}
		options={withCurrent(
			MONO_FONTS.map(({ value, label }) => ({ value, label: $lang(label) })),
			knob('font_mono'),
			$lang,
			familyName(knob('font_mono'))
		)}
		onchange={(value) => setKnob('font_mono', value)}
	/>

	<SelectField
		label={$lang('hearth_text_contrast')}
		value={textContrast}
		options={TEXT_CONTRAST_SCALES.map(({ value }) => ({
			value,
			label: $lang(`hearth_text_contrast_${value}`)
		}))}
		onchange={(value) => {
			const scale = TEXT_CONTRAST_SCALES.find((entry) => entry.value === value);
			if (scale) {
				patchTheme(deriveText(knob('text_1'), knob('background_outer'), light, scale.fade));
			}
		}}
	/>

	<SelectField
		label={$lang('hearth_text_shadow')}
		value={textShadow}
		options={TEXT_SHADOW_SCALES.map(({ value }) => ({
			value,
			label: $lang(`hearth_text_shadow_${value}`)
		}))}
		onchange={(value) => {
			const scale = TEXT_SHADOW_SCALES.find((entry) => entry.value === value);
			if (scale) patchTheme({ text_shadow: scale.shadow });
		}}
	/>

	<SelectField
		label={$lang('hearth_glass')}
		value={surfaceBlur}
		options={SURFACE_BLUR_SCALES.map(({ value }) => ({
			value,
			label: $lang(`hearth_glass_${value}`)
		}))}
		onchange={(value) => {
			const scale = SURFACE_BLUR_SCALES.find((entry) => entry.value === value);
			if (scale) patchTheme({ surface_blur: scale.blur });
		}}
	/>

	<SelectField
		label={$lang('hearth_corners')}
		value={radiusScale}
		options={RADIUS_SCALES.map(({ value }) => ({
			value,
			label: $lang(`hearth_corners_${value}`)
		}))}
		onchange={(value) => {
			const scale = RADIUS_SCALES.find((entry) => entry.value === value);
			if (scale) patchTheme(deriveRadii(scale.factor));
		}}
	/>

	<div class="field-hint">
		{$lang('hearth_pickers_set_sensible_derived_shades_automatically')}
	</div>
	<div
		class="reset pressable"
		onclick={() => applyPreset(null)}
		role="button"
		tabindex="0"
		onkeydown={(event) => activateOnKeyboard(event, () => applyPreset(null))}
	>
		{slot === 'night'
			? $lang('hearth_reset_the_night_theme_to_defaults')
			: $lang('hearth_reset_the_day_theme_to_defaults')}
	</div>
</EditSheet>

<style>
	/* groups the fields for one change listener without taking a grid cell */
	.switch-fields {
		display: contents;
	}

	.slots {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		margin-bottom: 12px;
	}

	.slot {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 12px;
		border-radius: var(--h-radius-xs);
		background: rgb(var(--h-surface-rgb) / calc(0.05 * var(--h-fill-scale)));
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		font-size: var(--h-type-body);
		color: var(--h-text-4);
		cursor: pointer;
	}

	.slot.active {
		background: rgb(var(--h-accent-rgb) / calc(0.16 * var(--h-accent-scale)));
		border-color: rgb(var(--h-accent-rgb) / calc(0.4 * var(--h-accent-scale)));
		color: var(--h-accent-text);
	}

	.slot-note {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 1px;
		color: var(--h-text-4);
	}

	.group-label {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-label);
		margin: 4px 0 10px;
	}

	.presets {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		margin-bottom: 18px;
	}

	.preset {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: var(--h-radius-xs);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		font-size: var(--h-type-body);
		color: var(--h-text-3);
		cursor: pointer;
	}

	.preview {
		width: 22px;
		height: 22px;
		border-radius: var(--h-radius-tight);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.2 * var(--h-line-scale)));
		flex: none;
	}

	.picker-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		margin-bottom: 18px;
	}

	.reset {
		text-align: center;
		padding: 12px;
		border-radius: var(--h-radius-xs);
		border: 1px dashed rgb(var(--h-line-rgb) / calc(0.15 * var(--h-line-scale)));
		color: var(--h-text-5);
		font-size: var(--h-type-body);
		cursor: pointer;
	}

	@media (hover: hover) {
		.reset:hover {
			color: var(--h-text-3);
		}
	}

	.save-row {
		display: flex;
		gap: 8px;
		margin-bottom: 10px;
	}

	.save-row input {
		flex: 1;
		padding: 12px 14px;
		border-radius: var(--h-radius-xs);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		background: var(--h-track);
		color: var(--h-text-2);
		font-family: inherit;
		font-size: var(--h-type-body);
		outline: none;
		min-width: 0;
	}

	.save-row input:focus {
		border-color: rgb(var(--h-accent-rgb) / calc(0.4 * var(--h-accent-scale)));
	}

	.save-row input::placeholder {
		color: var(--h-text-6);
	}

	/* iOS Safari zooms the page into any input set under 16px */
	@media (pointer: coarse) {
		.save-row input {
			font-size: max(var(--h-input-floor), var(--h-type-body));
		}
	}

	.save-row .button {
		flex: none;
		padding: 0 16px;
		border-radius: var(--h-radius-xs);
		background: rgb(var(--h-accent-rgb) / calc(0.16 * var(--h-accent-scale)));
		color: var(--h-accent-text);
		font-size: var(--h-type-body);
		font-weight: 600;
		display: flex;
		align-items: center;
		cursor: pointer;
	}

	.save-row .button {
		border: 0;
		font-family: inherit;
		cursor: pointer;
	}

	.save-row .button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.saved-themes {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 8px;
	}

	.saved-theme {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: var(--h-radius-xs);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		font-size: var(--h-type-body);
		color: var(--h-text-3);
		cursor: pointer;
	}

	.dots {
		display: flex;
		flex: none;
	}

	.dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.25 * var(--h-line-scale)));
		margin-left: -6px;
	}

	.dot:first-child {
		margin-left: 0;
	}

	.saved-theme-apply {
		display: flex;
		flex: 1;
		min-width: 0;
		align-items: center;
		gap: 10px;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.saved-theme-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.icon-button {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		margin: -10px -10px -10px 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--h-icon);
		cursor: pointer;
	}

	@media (hover: hover) {
		.icon-button:hover {
			color: var(--h-bad-text);
		}
	}

	.error {
		font-size: var(--h-type-small);
		color: var(--h-bad-text);
		margin-bottom: 10px;
	}

	.share-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 18px;
	}

	.share-row .hearth-button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.import-preview {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		margin-bottom: 8px;
		border-radius: var(--h-radius-xs);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		font-size: var(--h-type-body);
		color: var(--h-text-3);
	}

	.token-count {
		flex: none;
		font-size: var(--h-type-small);
		color: var(--h-text-5);
	}
</style>
