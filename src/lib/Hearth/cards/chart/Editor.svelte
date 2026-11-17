<script lang="ts">
	import type { CardEditorProps } from '../types';
	import type { ChartCard } from './descriptor';
	import { fill, lang } from '$lib/core/i18n';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';
	import EntitiesField, {
		editableEntities,
		storedEntities,
		type EditableChartEntity
	} from './EntitiesField.svelte';

	let { initial, onchange }: CardEditorProps<ChartCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{ key: 'name', kind: 'text', label: 'hearth_name_optional' },
		{
			key: 'style',
			kind: 'select',
			label: 'hearth_chart_style',
			default: 'line',
			options: [
				{ value: 'line', label: 'hearth_chart_line' },
				{ value: 'bar', label: 'hearth_chart_bar' }
			]
		},
		{
			key: 'period',
			kind: 'select',
			label: 'hearth_period',
			default: 'day',
			beside: true,
			options: [
				{ value: 'day', label: 'hearth_last_day' },
				{ value: 'week', label: 'hearth_last_week' },
				{ value: 'month', label: 'hearth_last_month' }
			]
		}
	]);

	// svelte-ignore state_referenced_locally
	let entities = $state<EditableChartEntity[]>(editableEntities(initial?.entities));
	let entitiesValid = $state(true);

	$effect(() => {
		const stored = storedEntities($state.snapshot(entities));
		const draft = { fields: { ...form.stored, entities: stored } };
		if (!form.validity.valid) onchange({ ...draft, ...form.validity });
		else if (!stored)
			onchange({
				...draft,
				valid: false,
				reason: fill($lang('hearth_field_required'), { field: $lang('entity') })
			});
		else onchange({ ...draft, valid: entitiesValid });
	});
</script>

<FormRenderer {form} />
<EntitiesField bind:value={entities} bind:valid={entitiesValid} />
