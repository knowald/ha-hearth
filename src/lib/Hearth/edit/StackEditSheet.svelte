<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { get } from 'svelte/store';
	import {
		ensureRoomCardColumns,
		isStack,
		moveItem,
		takenCardIds,
		uniqueId,
		type HearthConfig,
		type OverviewItem,
		type OverviewStack
	} from '../config';
	import { editor, hearthConfig, updateConfig } from '../store';
	import EditSheet from './EditSheet.svelte';
	import SelectField from './SelectField.svelte';
	import TextField from './TextField.svelte';

	let { roomId, column, index }: { roomId: string; column: number; index: number | null } =
		$props();

	function columnItems(config: HearthConfig) {
		return config.rooms.find((entry) => entry.id === roomId)?.cards?.[column];
	}

	// initial value only - the sheet is remounted per editor target via {#key}
	// svelte-ignore state_referenced_locally
	const initialItem = index !== null ? columnItems(get(hearthConfig))?.[index] : undefined;
	const initial = initialItem && isStack(initialItem) ? initialItem : undefined;

	// moving the stack shifts its index, so later writes find it by id
	function stackIndex(items: OverviewItem[] | undefined) {
		return initial ? (items?.findIndex((item) => item.id === initial.id) ?? -1) : -1;
	}

	let title = $state(initial?.title ?? '');
	let direction = $state<OverviewStack['direction']>(initial?.direction ?? 'horizontal');
	let fill = $state<string>(typeof initial?.fill === 'number' ? String(initial.fill) : '');

	let DIRECTION_OPTIONS: { value: OverviewStack['direction']; label: string }[] = $derived([
		{ value: 'horizontal', label: $lang('horizontal') },
		{ value: 'vertical', label: $lang('vertical') }
	]);

	function close() {
		editor.set(null);
	}

	function appendStack(config: HearthConfig): OverviewStack | undefined {
		const room = config.rooms.find((entry) => entry.id === roomId);
		const items = room ? ensureRoomCardColumns(room)[column] : undefined;
		if (!items) return undefined;
		const stack: OverviewStack = {
			id: uniqueId('stack', takenCardIds(config)),
			kind: 'stack',
			direction,
			cards: []
		};
		items.push(stack);
		return stack;
	}

	function done() {
		updateConfig((config) => {
			const items = columnItems(config);
			const target = initial ? items?.[stackIndex(items)] : appendStack(config);
			if (!target || !isStack(target)) return;
			target.title = title.trim() || undefined;
			target.direction = direction;
			const fillValue = fill === '' ? undefined : Number(fill);
			target.fill = Number.isFinite(fillValue as number) ? fillValue : undefined;
		});
		close();
	}

	// unwrap: the stack disappears but its children move up into the column
	// at the stack's position - they are never destroyed
	function unwrap() {
		updateConfig((config) => {
			const items = columnItems(config);
			const position = stackIndex(items);
			const target = items?.[position];
			if (!items || !target || !isStack(target)) return;
			items.splice(position, 1, ...target.cards);
		});
		close();
	}

	function move(delta: number) {
		updateConfig((config) => {
			const items = columnItems(config);
			if (items) moveItem(items, stackIndex(items), delta);
		});
	}
</script>

<EditSheet
	title={$lang(index !== null ? 'hearth_edit_stack' : 'hearth_add_stack')}
	onclose={close}
	ondone={done}
	onremove={initial ? unwrap : undefined}
	removeLabel={$lang('hearth_unwrap')}
	removeTone="neutral"
	onmoveup={initial ? () => move(-1) : undefined}
	onmovedown={initial ? () => move(1) : undefined}
>
	<TextField
		label={$lang('hearth_title_optional')}
		bind:value={title}
		placeholder={$lang('hearth_example_page_name')}
	/>
	<SelectField label={$lang('fan_direction')} bind:value={direction} options={DIRECTION_OPTIONS} />
	<SelectField
		label={$lang('hearth_fill_leftover_height')}
		bind:value={fill}
		options={[
			{ value: '', label: $lang('hearth_fill_default_stack') },
			{ value: '0', label: $lang('hearth_fill_none') },
			{ value: '1', label: $lang('hearth_fill_one') },
			{ value: '2', label: $lang('hearth_fill_double') },
			{ value: '3', label: $lang('hearth_fill_triple') }
		]}
	/>
</EditSheet>
