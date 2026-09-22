<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { entityActiveFor, states } from '$lib/core/ha/entities';
	import { callEntityService, controlOverrides } from '$lib/core/ha/commands';
	import { setEntityActive } from '$lib/core/domains/entity';
	import { pressFeedback } from '../pressFeedback';
	import { relativeTime } from '$lib/core/i18n/time';
	import { selectedLanguage } from '$lib/core/i18n';

	let { entity }: { entity: string } = $props();

	let stateObj = $derived($states?.[entity]);
	let on = $derived(entityActiveFor(entity, stateObj, $controlOverrides));
	let lastTriggered = $derived(stateObj?.attributes?.last_triggered as string | undefined);
</script>

<div class="readout">
	<span>{$lang('hearth_last_triggered')}</span>
	<strong
		>{lastTriggered
			? relativeTime(lastTriggered, $selectedLanguage)
			: $lang('hearth_never')}</strong
	>
</div>
<div class="label">{$lang('state')}</div>
<div class="segments">
	<button
		type="button"
		class="segment"
		use:pressFeedback={entity}
		class:active={on}
		onclick={() => setEntityActive(entity, true)}
	>
		{$lang('hearth_turn_on')}
	</button>
	<button
		type="button"
		class="segment"
		use:pressFeedback={entity}
		class:active={!on}
		onclick={() => setEntityActive(entity, false)}
	>
		{$lang('hearth_turn_off')}
	</button>
	<button
		type="button"
		class="segment"
		use:pressFeedback={entity}
		onclick={() => callEntityService('automation', 'trigger', entity)}
	>
		{$lang('hearth_run_actions')}
	</button>
</div>
