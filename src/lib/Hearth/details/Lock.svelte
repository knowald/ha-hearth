<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import { controlOverrides } from '$lib/core/ha/commands';
	import { guardLockCommand } from '$lib/core/domains/lock';
	import { requestConfirmation } from '../store';
	import { pressFeedback } from '../pressFeedback';

	let { entity }: { entity: string } = $props();

	let stateObj = $derived($states?.[entity]);
	let locked = $derived.by(() => {
		const override = $controlOverrides[`active:${entity}`];
		return override !== undefined ? override === 0 : stateObj?.state === 'locked';
	});
	// supported_features bit 1: the lock can also open (a latch)
	let canOpen = $derived(((stateObj?.attributes?.supported_features ?? 0) & 1) === 1);
</script>

<div class="segments">
	<button
		type="button"
		class="segment"
		class:active={locked}
		use:pressFeedback={entity}
		onclick={() => guardLockCommand(entity, 'lock', requestConfirmation)}
	>
		{$lang('hearth_lock')}
	</button>
	<button
		type="button"
		class="segment"
		class:active={!locked}
		use:pressFeedback={entity}
		onclick={() => guardLockCommand(entity, 'unlock', requestConfirmation)}
	>
		{$lang('hearth_unlock')}
	</button>
	{#if canOpen}
		<button
			type="button"
			class="segment"
			use:pressFeedback={entity}
			onclick={() => guardLockCommand(entity, 'open', requestConfirmation)}
		>
			{$lang('hearth_open_door')}
		</button>
	{/if}
</div>
