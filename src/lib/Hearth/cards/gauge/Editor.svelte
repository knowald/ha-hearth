<script lang="ts">
	import type { CardEditorProps } from '../types';
	import type { GaugeCard } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm, type FormValues } from '../../edit/form.svelte';
	import { numberFromInput } from '../../edit/numbers';
	import { GAUGE_MAX, GAUGE_MIN } from '../../model/cards/gauge';
	import SegmentsField, { storedSegments, type EditableSegment } from './SegmentsField.svelte';

	let { initial, onchange }: CardEditorProps<GaugeCard> = $props();

	function bound(text: unknown, fallback: number): number {
		const value = numberFromInput(String(text ?? ''));
		return Number.isFinite(value) ? value : fallback;
	}

	// either end typed past the other stores nothing and is marked invalid
	function ordered(values: FormValues): boolean {
		return bound(values.min, GAUGE_MIN) < bound(values.max, GAUGE_MAX);
	}

	function writeBound(raw: unknown, values: FormValues): number | undefined {
		const value = numberFromInput(String(raw));
		return Number.isFinite(value) && ordered(values) ? value : undefined;
	}

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{
			key: 'entity',
			kind: 'entity',
			required: true,
			domains: ['sensor', 'input_number', 'number']
		},
		{ key: 'name', kind: 'text', label: 'hearth_name_optional' },
		{ key: 'unit', kind: 'text', label: 'hearth_unit' },
		{
			key: 'min',
			kind: 'number',
			label: 'hearth_minimum',
			placeholder: String(GAUGE_MIN),
			inputmode: 'decimal',
			write: writeBound,
			invalid: 'hearth_gauge_min_below_max'
		},
		{
			key: 'max',
			kind: 'number',
			label: 'hearth_maximum',
			placeholder: String(GAUGE_MAX),
			inputmode: 'decimal',
			beside: true,
			write: writeBound,
			invalid: 'hearth_gauge_min_below_max'
		},
		{
			key: 'needle',
			kind: 'check',
			label: 'hearth_needle',
			hint: 'hearth_needle_hint'
		}
	]);

	// svelte-ignore state_referenced_locally
	let segments = $state<EditableSegment[]>(
		(initial?.segments ?? []).map((segment) => ({
			from: String(segment.from),
			color: segment.color
		}))
	);
	let segmentsValid = $state(true);

	$effect(() => {
		onchange({
			fields: { ...form.stored, segments: storedSegments($state.snapshot(segments)) },
			...form.validity,
			valid: form.validity.valid && segmentsValid
		});
	});
</script>

<FormRenderer {form} />
<SegmentsField bind:value={segments} bind:valid={segmentsValid} />
