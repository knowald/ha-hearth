<script lang="ts">
	import Switch from '../Switch.svelte';
	import FieldMessages, { describedBy } from './FieldMessages.svelte';

	const uid = $props.id();

	let {
		label,
		checked = $bindable(false),
		hint = undefined,
		error = undefined,
		onchange = undefined
	}: {
		label: string;
		checked?: boolean;
		hint?: string;
		error?: string | null;
		onchange?: (checked: boolean) => void;
	} = $props();
</script>

<div class="field">
	<!-- the whole row toggles, so the target stays finger-sized beside a short switch -->
	<label class="check">
		<Switch
			{checked}
			{label}
			describedby={describedBy(uid, hint, error)}
			invalid={Boolean(error)}
			onchange={(next) => {
				checked = next;
				onchange?.(next);
			}}
		/>
		<span class="check-label">{label}</span>
	</label>
	<FieldMessages id={uid} {hint} {error} />
</div>

<style>
	.field {
		display: block;
		margin: 4px 0 10px;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		font-size: var(--h-type-body);
		color: var(--h-text-3);
		cursor: pointer;
		user-select: none;
		-webkit-user-select: none;
	}

	.check-label {
		flex: 1;
		min-width: 0;
	}
</style>
