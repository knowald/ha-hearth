<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import type { WidgetEditorProps } from '../types';
	import type { WeatherWidget } from './descriptor';
	import EntityField from '../../edit/EntityField.svelte';
	import { requireFields } from '../../edit/validation';

	let { initial: initialProp, onchange }: WidgetEditorProps<WeatherWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const initial = initialProp;

	let entity = $state(initial?.entity ?? '');

	let validity = $derived(
		requireFields($lang('hearth_field_required'), {
			label: $lang('hearth_weather_entity'),
			value: entity
		})
	);

	$effect(() => {
		onchange({ fields: { entity: entity.trim() || undefined }, ...validity });
	});
</script>

<EntityField
	label={$lang('hearth_weather_entity')}
	required
	bind:value={entity}
	domains={['weather']}
/>
