<script lang="ts">
	import { numberFromInput } from '../../edit/numbers';
	import { lang } from '$lib/core/i18n';
	import type { WidgetEditorProps } from '../types';
	import type { EnergyWidget } from './descriptor';
	import CheckField from '../../edit/CheckField.svelte';
	import EntityField from '../../edit/EntityField.svelte';
	import TextField from '../../edit/TextField.svelte';
	import { requireFields } from '../../edit/validation';

	let { initial: initialProp, onchange }: WidgetEditorProps<EnergyWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const initial = initialProp;

	let entity = $state(initial?.entity ?? '');
	let price = $state(typeof initial?.price === 'number' ? String(initial.price) : '');
	let priceEntity = $state(initial?.price_entity ?? '');
	let currency = $state(initial?.currency ?? '');
	let averageBadge = $state(initial?.average_badge !== false);

	let validity = $derived(
		requireFields($lang('hearth_field_required'), {
			label: $lang('hearth_energy_sensor'),
			value: entity
		})
	);

	$effect(() => {
		const parsedPrice = numberFromInput(price);
		onchange({
			fields: {
				entity: entity.trim() || undefined,
				price: Number.isFinite(parsedPrice) ? parsedPrice : undefined,
				price_entity: priceEntity.trim() || undefined,
				currency: currency.trim() || undefined,
				average_badge: averageBadge ? undefined : false
			},
			...validity
		});
	});
</script>

<EntityField
	label={$lang('hearth_energy_sensor_today_total_or_increasing')}
	required
	bind:value={entity}
	domains={['sensor']}
/>
<TextField
	label={$lang('hearth_price_per_kwh_optional')}
	bind:value={price}
	placeholder="0.72"
	inputmode="decimal"
/>
<EntityField
	label={$lang('hearth_price_entity_optional_overrides_static_price')}
	bind:value={priceEntity}
	domains={['sensor', 'input_number']}
/>
<TextField label={$lang('hearth_currency_label_optional')} bind:value={currency} placeholder="zł" />
<CheckField
	label={$lang('hearth_energy_average_badge')}
	hint={$lang('hearth_energy_average_badge_hint')}
	bind:checked={averageBadge}
/>
