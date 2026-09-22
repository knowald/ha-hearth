<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { states, entityActiveFor } from '$lib/core/ha/entities';
	import { controlOverrides } from '$lib/core/ha/commands';
	import { setEntityActive, toggleEntity } from '$lib/core/domains/entity';
	import { pressFeedback } from '../pressFeedback';

	let { entity }: { entity: string } = $props();

	let on = $derived(entityActiveFor(entity, $states?.[entity], $controlOverrides));
</script>

<div class="label">{$lang('state')}</div>
<div class="segments">
	<button
		type="button"
		class="segment"
		class:active={on}
		use:pressFeedback={entity}
		onclick={() => setEntityActive(entity, true)}
	>
		{$lang('hearth_turn_on')}
	</button>
	<button
		type="button"
		class="segment"
		class:active={!on}
		use:pressFeedback={entity}
		onclick={() => setEntityActive(entity, false)}
	>
		{$lang('hearth_turn_off')}
	</button>
	<button
		type="button"
		class="segment"
		use:pressFeedback={entity}
		onclick={() => toggleEntity(entity)}>{$lang('toggle')}</button
	>
</div>
