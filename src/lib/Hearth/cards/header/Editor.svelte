<script lang="ts">
	import type { CardEditorProps } from '../types';
	import type { HeaderCard } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import HeaderStatsField, { type EditableStat } from '../../edit/HeaderStatsField.svelte';
	import { EditorForm } from '../../edit/form.svelte';
	import { headerStatList, storedHeaderStats } from '../../model/headerStats';

	let { initial, onchange }: CardEditorProps<HeaderCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{ key: 'title', kind: 'text', label: 'hearth_title', example: 'hearth_example_header_title' },
		{
			key: 'subtitle',
			kind: 'text',
			label: 'hearth_subtitle',
			example: 'hearth_example_page_summary'
		},
		{ key: 'icon', kind: 'icon', default: 'home', placeholder: 'home' },
		{ key: 'background_image', kind: 'image', label: 'hearth_background_image' }
	]);

	// svelte-ignore state_referenced_locally
	let stats = $state<EditableStat[]>(
		headerStatList(initial).map((stat) => ({ entity: stat.entity, name: stat.name ?? '' }))
	);

	$effect(() => {
		onchange({
			fields: {
				...form.stored,
				...storedHeaderStats($state.snapshot(stats), initial)
			},
			...form.validity
		});
	});
</script>

<FormRenderer {form} />
<HeaderStatsField bind:value={stats} />
