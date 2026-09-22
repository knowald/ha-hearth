<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import EmptyState from './EmptyState.svelte';

	let { text, context = 'card' }: { text: string; context?: 'card' | 'widget' } = $props();
</script>

<EmptyState
	icon="tune"
	{text}
	hint={context === 'card'
		? $lang('hearth_open_the_card_editor_to_finish')
		: $lang('hearth_open_the_widget_editor_to_finish')}
/>
