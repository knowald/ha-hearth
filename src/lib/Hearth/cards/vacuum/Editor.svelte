<script lang="ts">
	import { ICON } from '../../iconSizes';
	import { lang } from '$lib/core/i18n';
	import type { CardEditorProps } from '../types';
	import type { VacuumCard } from './descriptor';
	import { activateOnKeyboard } from '../../interaction';
	import CheckField from '../../edit/CheckField.svelte';
	import EntityField from '../../edit/EntityField.svelte';
	import Icon from '../../Icon.svelte';
	import IconField from '../../edit/IconField.svelte';
	import TextField from '../../edit/TextField.svelte';
	import { requireFields } from '../../edit/validation';

	let { initial: initialProp, onchange }: CardEditorProps<VacuumCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const initial = initialProp;

	type EditableMode = {
		entity: string;
		name: string;
		icon: string;
		detail: string;
		duration: string;
		default: boolean;
	};

	let entity = $state(initial?.entity ?? '');
	let batteryEntity = $state(initial?.battery_entity ?? '');
	let binEntity = $state(initial?.bin_entity ?? '');
	let quickAction = $state(initial?.quick_action ?? false);
	let modes = $state<EditableMode[]>(
		(initial?.modes ?? []).map((ref) => ({
			entity: ref.entity ?? '',
			name: ref.name ?? '',
			icon: ref.icon ?? '',
			detail: ref.detail ?? '',
			duration: ref.duration ?? '',
			default: ref.default ?? false
		}))
	);

	// only one mode carries the tag, so checking a row clears the rest
	function setDefaultMode(index: number, checked: boolean) {
		modes = modes.map((mode, position) => ({ ...mode, default: checked && position === index }));
	}

	function addMode() {
		modes.push({ entity: '', name: '', icon: '', detail: '', duration: '', default: false });
	}

	let validity = $derived(
		requireFields($lang('hearth_field_required'), {
			label: $lang('entity'),
			value: entity
		})
	);

	$effect(() => {
		onchange({
			fields: {
				entity: entity.trim() || undefined,
				modes: modes
					.map((ref) => ({
						entity: ref.entity.trim(),
						name: ref.name.trim() || undefined,
						icon: ref.icon.trim() || undefined,
						detail: ref.detail.trim() || undefined,
						duration: ref.duration.trim() || undefined,
						default: ref.default || undefined
					}))
					.filter((ref) => ref.entity),
				battery_entity: batteryEntity.trim() || undefined,
				bin_entity: binEntity.trim() || undefined,
				quick_action: quickAction || undefined
			},
			...validity
		});
	});
</script>

<EntityField label={$lang('entity')} required bind:value={entity} domains={['vacuum']} />
<EntityField
	label={$lang('hearth_battery_entity_optional')}
	bind:value={batteryEntity}
	domains={['sensor']}
/>
<EntityField
	label={$lang('hearth_dustbin_entity_optional')}
	bind:value={binEntity}
	domains={['sensor']}
/>
<CheckField label={$lang('hearth_one_tap_clean_stop_button_on')} bind:checked={quickAction} />
<div class="group-label">{$lang('hearth_cleaning_modes')}</div>
<div class="hint">
	{$lang('hearth_button_entities_launched_from_the_vacuum')}
</div>
{#each modes as mode, modeIndex (modeIndex)}
	<div class="filter-row">
		<div class="filter-fields">
			<EntityField
				label={$lang('hearth_button_entity')}
				bind:value={mode.entity}
				domains={['button']}
				hint={mode.entity.trim() ? undefined : $lang('hearth_empty_row_removed')}
			/>
			<TextField label={$lang('hearth_name_optional')} bind:value={mode.name} />
			<IconField label={$lang('hearth_icon_optional')} bind:value={mode.icon} />
			<TextField
				label={$lang('hearth_covers_optional')}
				bind:value={mode.detail}
				placeholder={$lang('hearth_example_vacuum_covers')}
			/>
			<TextField
				label={$lang('hearth_duration_optional')}
				bind:value={mode.duration}
				placeholder="26 min"
			/>
			<CheckField
				label={$lang('hearth_recommended_mode')}
				checked={mode.default}
				onchange={(checked) => setDefaultMode(modeIndex, checked)}
			/>
		</div>
		<button
			type="button"
			class="remove"
			aria-label={$lang('hearth_remove_cleaning_mode')}
			onclick={() => modes.splice(modeIndex, 1)}
		>
			<Icon name="delete" size={ICON.control} />
		</button>
	</div>
{/each}
<div
	class="add-filter"
	role="button"
	tabindex="0"
	onclick={addMode}
	onkeydown={(event) => activateOnKeyboard(event, addMode)}
>
	<Icon name="add" size={ICON.control} />
	<span>{$lang('hearth_add_cleaning_mode')}</span>
</div>
