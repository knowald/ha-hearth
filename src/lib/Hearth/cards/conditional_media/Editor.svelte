<script lang="ts">
	import { ICON } from '../../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { activateOnKeyboard } from '../../interaction';
	import type { CardEditorProps } from '../types';
	import type { ConditionalMediaCard } from './descriptor';
	import EntityField from '../../edit/EntityField.svelte';
	import EntityPicker from '../../edit/EntityPicker.svelte';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';
	import Icon from '../../Icon.svelte';

	let { initial: initialProp, onchange }: CardEditorProps<ConditionalMediaCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const initial = initialProp;

	let players = $state<{ entity: string }[]>(
		(initial?.media_players ?? []).map((entity) => ({ entity }))
	);
	let pickingMany = $state(false);
	const form = new EditorForm(initial, [
		{
			key: 'timeout',
			kind: 'number',
			label: 'hearth_pause_timeout',
			placeholder: '300',
			inputmode: 'numeric',
			integer: true,
			min: 0
		}
	]);

	$effect(() => {
		onchange({
			fields: {
				media_players: players.map((row) => row.entity.trim()).filter(Boolean),
				...form.stored
			}
		});
	});
</script>

<div class="group-label">{$lang('hearth_media_players')}</div>
{#each players as row, index (index)}
	<div class="filter-row">
		<div class="filter-fields">
			<EntityField
				label={$lang('entity')}
				bind:value={row.entity}
				domains={['media_player']}
				hint={row.entity.trim() ? undefined : $lang('hearth_empty_row_removed')}
			/>
		</div>
		<button
			type="button"
			class="remove"
			aria-label={$lang('hearth_remove_player')}
			onclick={() => players.splice(index, 1)}
		>
			<Icon name="delete" size={ICON.control} />
		</button>
	</div>
{/each}
<div
	class="add-filter"
	role="button"
	tabindex="0"
	onclick={() => players.push({ entity: '' })}
	onkeydown={(event) => activateOnKeyboard(event, () => players.push({ entity: '' }))}
>
	<Icon name="add" size={ICON.control} />
	<span>{$lang('hearth_add_player')}</span>
</div>
<div
	class="add-filter"
	role="button"
	tabindex="0"
	onclick={() => (pickingMany = true)}
	onkeydown={(event) => activateOnKeyboard(event, () => (pickingMany = true))}
>
	<Icon name="playlist_add" size={ICON.control} />
	<span>{$lang('hearth_pick_several_entities')}</span>
</div>

{#if pickingMany}
	<EntityPicker
		multiple
		domains={['media_player']}
		taken={players.map((row) => row.entity.trim()).filter(Boolean)}
		onselectmany={(entityIds) => players.push(...entityIds.map((entity) => ({ entity })))}
		onclose={() => (pickingMany = false)}
	/>
{/if}
<FormRenderer {form} />
