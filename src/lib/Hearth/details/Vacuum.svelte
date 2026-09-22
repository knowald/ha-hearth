<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import { vacuumActions, vacuumCommand } from '$lib/core/domains/vacuum';
	import { pressFeedback } from '../pressFeedback';

	let { entity }: { entity: string } = $props();

	let stateObj = $derived($states?.[entity]);
	let battery = $derived(stateObj?.attributes?.battery_level);
	let actions = $derived(
		vacuumActions(stateObj?.state, stateObj?.attributes?.supported_features ?? 0)
	);
</script>

{#if typeof battery === 'number'}
	<div class="readout"><span>{$lang('hearth_battery')}</span><strong>{battery}%</strong></div>
{/if}
<div class="segments">
	{#each actions as action (action.command)}
		<button
			type="button"
			class="segment"
			class:active={action.primary}
			use:pressFeedback={entity}
			onclick={() => vacuumCommand(entity, action.command)}>{$lang(action.label)}</button
		>
	{/each}
</div>
