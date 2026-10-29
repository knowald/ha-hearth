<script module lang="ts">
	import type { HearthConfig } from '../../config';

	/** The dashboard keys this section's rows change. */
	export const SETTING_KEYS = [
		'scale',
		'padding_x',
		'padding_y',
		'mobile_scale',
		'mobile_padding_x',
		'mobile_padding_y'
	] as const satisfies readonly (keyof HearthConfig)[];
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { integerFromInput } from '../numbers';
	import { lang } from '$lib/core/i18n';
	import { screenOverrides } from '$lib/core/app/screen';
	import { hearthConfig, updateConfig } from '../../store';
	import SettingsRow from '../SettingsRow.svelte';
	import { zoomSupported } from '../../zoom';
	import GroupTitle from './GroupTitle.svelte';
	import NumberStepper from './NumberStepper.svelte';
	import SettingsSection from './SettingsSection.svelte';

	let paddingX = $derived($hearthConfig.padding_x ?? 0);
	let paddingY = $derived($hearthConfig.padding_y ?? 0);
	let mobilePaddingX = $derived($hearthConfig.mobile_padding_x ?? paddingX);
	let mobilePaddingY = $derived($hearthConfig.mobile_padding_y ?? paddingY);
	let scale = $derived($hearthConfig.scale ?? 100);
	let mobileScale = $derived($hearthConfig.mobile_scale ?? scale);

	type PaddingKey = 'padding_x' | 'padding_y' | 'mobile_padding_x' | 'mobile_padding_y';

	function setPadding(axis: PaddingKey, value: string, shown: number) {
		const pixels = integerFromInput(value);
		storeStepper(
			axis,
			Number.isFinite(pixels) ? Math.min(300, Math.max(0, pixels)) : undefined,
			0,
			shown
		);
	}

	type ScaleKey = 'scale' | 'mobile_scale';

	function setScale(key: ScaleKey, value: string, shown: number) {
		const percent = integerFromInput(value);
		storeStepper(
			key,
			Number.isFinite(percent) ? Math.min(200, Math.max(50, percent)) : undefined,
			100,
			shown
		);
	}

	/**
	 * Undefined clears the key. Tablet rows drop their default; mobile rows keep
	 * any value, since even the default overrides a different tablet value. A
	 * mobile row still following the tablet one stays unset when the press or
	 * typed value lands on the number it already shows.
	 */
	function storeStepper(
		key: PaddingKey | ScaleKey,
		next: number | undefined,
		fallback: number,
		shown: number
	) {
		const mobile = key.startsWith('mobile_');
		if (mobile && $hearthConfig[key] === undefined && next === shown) return;
		updateConfig((config) => {
			config[key] = next === undefined || (!mobile && next === fallback) ? undefined : next;
		});
	}

	interface StepperRow {
		label: string;
		decrease: string;
		increase: string;
		sub?: string;
		value: number;
		step: number;
		min: number;
		max: number;
		unit: string;
		set: (value: string) => void;
	}

	function paddingRow(
		key: PaddingKey,
		value: number,
		labels: Pick<StepperRow, 'label' | 'decrease' | 'increase' | 'sub'>
	): StepperRow {
		return {
			...labels,
			value,
			step: 4,
			min: 0,
			max: 300,
			unit: 'px',
			set: (input) => setPadding(key, input, value)
		};
	}

	function scaleRow(
		key: ScaleKey,
		value: number,
		labels: Pick<StepperRow, 'label' | 'decrease' | 'increase' | 'sub'>
	): StepperRow {
		return {
			...labels,
			// the mobile row's hint is the only place that explains the mobile rows,
			// so the unsupported note goes on the main row alone
			sub:
				// a screen's own scale also applies at narrow widths (see screen.ts)
				$screenOverrides[key] !== undefined ||
				(key === 'mobile_scale' && $screenOverrides.scale !== undefined)
					? 'hearth_this_screen_uses_its_own'
					: zoomSupported || key === 'mobile_scale'
						? labels.sub
						: 'hearth_scale_unsupported',
			value,
			step: 5,
			min: 50,
			max: 200,
			unit: '%',
			set: (input) => setScale(key, input, value)
		};
	}

	let wideRows = $derived([
		scaleRow('scale', scale, {
			label: 'hearth_interface_scale',
			decrease: 'hearth_decrease_interface_scale',
			increase: 'hearth_increase_interface_scale',
			sub: 'hearth_size_of_text_and_controls'
		}),
		paddingRow('padding_x', paddingX, {
			label: 'hearth_side_padding',
			decrease: 'hearth_decrease_side_padding',
			increase: 'hearth_increase_side_padding',
			sub: 'hearth_for_screens_whose_frame_covers_the'
		}),
		paddingRow('padding_y', paddingY, {
			label: 'hearth_top_bottom_padding',
			decrease: 'hearth_decrease_top_bottom_padding',
			increase: 'hearth_increase_top_bottom_padding'
		})
	]);

	// mobile rows follow the wide ones; their hint reads "instead of the values above"
	let narrowRows = $derived([
		scaleRow('mobile_scale', mobileScale, {
			label: 'hearth_mobile_interface_scale',
			decrease: 'hearth_decrease_mobile_interface_scale',
			increase: 'hearth_increase_mobile_interface_scale',
			sub: 'hearth_for_phone_width_screens'
		}),
		paddingRow('mobile_padding_x', mobilePaddingX, {
			label: 'hearth_mobile_side_padding',
			decrease: 'hearth_decrease_mobile_side_padding',
			increase: 'hearth_increase_mobile_side_padding'
		}),
		paddingRow('mobile_padding_y', mobilePaddingY, {
			label: 'hearth_mobile_top_bottom_padding',
			decrease: 'hearth_decrease_mobile_top_bottom_padding',
			increase: 'hearth_increase_mobile_top_bottom_padding'
		})
	]);

	// A typed value that clamps to the stored one changes nothing, so the field
	// would keep showing the typed text; write the effective value back. The
	// row is read through a getter because the object passed in goes stale.
	async function commitInput(input: HTMLInputElement, row: () => StepperRow) {
		row().set(input.value);
		await tick();
		input.value = String(row().value);
	}
</script>

{#snippet stepperRow(row: StepperRow)}
	<SettingsRow label={$lang(row.label)} sub={row.sub && $lang(row.sub)}>
		<NumberStepper
			label={$lang(row.label)}
			value={row.value}
			min={row.min}
			max={row.max}
			unit={row.unit}
			decreaseLabel={$lang(row.decrease)}
			increaseLabel={$lang(row.increase)}
			onstep={(direction) => row.set(String(row.value + direction * row.step))}
			onchange={(input) => commitInput(input, () => row)}
		/>
	</SettingsRow>
{/snippet}

<SettingsSection title={$lang('hearth_size_and_spacing')} scope={$lang('hearth_scope_dashboard')}>
	{#each wideRows as row (row.label)}
		{@render stepperRow(row)}
	{/each}
	<GroupTitle title={$lang('hearth_screens_900_px_and_narrower')} />
	{#each narrowRows as row (row.label)}
		{@render stepperRow(row)}
	{/each}
</SettingsSection>
