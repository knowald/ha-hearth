<script lang="ts">
	import { integerFromInput } from './numbers';
	import { fill, lang } from '$lib/core/i18n';
	import { get } from 'svelte/store';
	import {
		normalizeVisibility,
		resizeCardColumns,
		slugify,
		uniqueId,
		type VisibilityCondition
	} from '../config';
	import { duplicateRoom, shiftItem } from '../model/layoutEdits';
	import { confirmDiscard } from './discard';
	import { currentRoom, editor, hearthConfig, updateConfig } from '../store';
	import { pageBackgroundIssue } from '../normalize';
	import { loadSavedThemes, savedThemes } from '../themeSchedule';
	import type { ScrimLevel } from '../types';
	import FormSection from './FormSection.svelte';
	import ImageField from './ImageField.svelte';
	import { themeOptions, withCurrent } from './options';
	import CheckField from './CheckField.svelte';
	import EditSheet from './EditSheet.svelte';
	import EntityField from './EntityField.svelte';
	import IconField from './IconField.svelte';
	import SelectField from './SelectField.svelte';
	import TextField from './TextField.svelte';
	import VisibilitySection from './VisibilitySection.svelte';
	import { requireFields } from './validation';

	let { id }: { id: string | null } = $props();

	const config = get(hearthConfig);
	// initial value only - the sheet is remounted per editor target via {#key}
	// svelte-ignore state_referenced_locally
	const initial = id ? config.rooms.find((entry) => entry.id === id) : undefined;

	let name = $state(initial?.name ?? '');
	let icon = $state(initial?.icon ?? 'meeting_room');
	let summary = $state(initial?.summary ?? '');
	let tempEntity = $state(initial?.temp_entity ?? '');
	let humidityEntity = $state(initial?.humidity_entity ?? '');
	let hideHeader = $state(initial?.hide_header ?? false);
	let fillScreen = $state(initial?.fill_screen ? 'fill' : 'scroll');
	let columns = $state(initial?.columns ? String(initial.columns) : '');
	// header moves are staged with the rest and applied on Done
	let moveBy = $state(0);
	let roomIndex = $derived($hearthConfig.rooms.findIndex((entry) => entry.id === id));
	let stagedIndex = $derived(roomIndex + moveBy);
	let visibility = $state<VisibilityCondition[]>(
		(initial?.visibility ?? []).map((condition) => ({ ...condition }))
	);
	let backgroundImage = $state(initial?.background_image ?? '');
	let backgroundScrim = $state<ScrimLevel>(initial?.background_scrim ?? 'medium');
	let pageTheme = $state(initial?.theme ?? '');

	let backgroundIssue = $derived(
		backgroundImage.trim() ? pageBackgroundIssue(backgroundImage.trim()) : null
	);

	$effect(() => {
		void loadSavedThemes();
	});

	function look() {
		const image = backgroundImage.trim();
		return {
			background_image: image || undefined,
			// medium is the default, so it is stored as unset
			background_scrim: image && backgroundScrim !== 'medium' ? backgroundScrim : undefined,
			theme: pageTheme.trim() || undefined
		};
	}

	function staged() {
		return {
			name,
			icon,
			summary,
			tempEntity,
			humidityEntity,
			hideHeader,
			fillScreen,
			columns,
			moveBy,
			visibility,
			backgroundImage,
			backgroundScrim,
			pageTheme
		};
	}

	let validity = $derived(
		backgroundIssue
			? { valid: false, reason: $lang('hearth_fix_marked_fields') }
			: requireFields($lang('hearth_field_required'), { label: $lang('name'), value: name })
	);

	const untouched = JSON.stringify(staged());
	let dirty = $derived(JSON.stringify(staged()) !== untouched);

	function close() {
		editor.set(null);
	}

	function done() {
		const columnCount = integerFromInput(columns);
		const roomColumns =
			Number.isFinite(columnCount) && columnCount >= 1 && columnCount <= 3
				? columnCount
				: undefined;
		updateConfig((next) => {
			if (id) {
				const room = next.rooms.find((entry) => entry.id === id);
				if (!room) return;
				room.name = name.trim();
				room.icon = icon.trim() || 'meeting_room';
				room.summary = summary.trim() || undefined;
				room.temp_entity = tempEntity.trim() || undefined;
				room.humidity_entity = humidityEntity.trim() || undefined;
				room.hide_header = hideHeader || undefined;
				room.fill_screen = fillScreen === 'fill' || undefined;
				room.columns = roomColumns;
				room.visibility = normalizeVisibility($state.snapshot(visibility));
				Object.assign(room, look());
				if (roomColumns !== undefined && room.cards?.length && room.cards.length !== roomColumns) {
					room.cards = resizeCardColumns(room.cards, roomColumns);
				}
				if (moveBy) shiftItem(next.rooms, next.rooms.indexOf(room), moveBy);
			} else {
				next.rooms.push({
					id: uniqueId(
						slugify(name),
						next.rooms.map((entry) => entry.id)
					),
					name: name.trim(),
					icon: icon.trim() || 'meeting_room',
					summary: summary.trim() || undefined,
					temp_entity: tempEntity.trim() || undefined,
					humidity_entity: humidityEntity.trim() || undefined,
					hide_header: hideHeader || undefined,
					fill_screen: fillScreen === 'fill' || undefined,
					columns: roomColumns,
					visibility: normalizeVisibility($state.snapshot(visibility)),
					...look(),
					cards: Array.from({ length: roomColumns ?? 1 }, () => [])
				});
			}
		});
		close();
	}

	function remove() {
		let fallback = '';
		updateConfig((next) => {
			next.rooms = next.rooms.filter((entry) => entry.id !== id);
			fallback = next.rooms[0]?.id ?? '';
		});
		if (get(currentRoom) === id) currentRoom.set(fallback);
		close();
	}

	function move(delta: number) {
		const target = Math.max(0, Math.min($hearthConfig.rooms.length - 1, stagedIndex + delta));
		moveBy = target - roomIndex;
	}

	// copies the page as saved, opens the copy and shows it behind the sheet
	function duplicate() {
		if (!id || !initial) return;
		const source = id;
		const copyName = fill($lang('hearth_page_copy_name'), { name: initial.name });
		confirmDiscard(dirty, () => {
			let copyId: string | undefined;
			updateConfig((next) => {
				copyId = duplicateRoom(next, source, copyName);
			});
			if (!copyId) return;
			currentRoom.set(copyId);
			editor.set({ kind: 'room', id: copyId });
		});
	}
</script>

<EditSheet
	title={$lang(id ? 'hearth_edit_page' : 'hearth_add_page')}
	onclose={close}
	ondone={done}
	{dirty}
	doneDisabled={!validity.valid}
	doneReason={validity.reason ?? null}
	onremove={id && $hearthConfig.rooms.length > 1 ? remove : undefined}
	onmoveup={id ? () => move(-1) : undefined}
	onmovedown={id ? () => move(1) : undefined}
	moveUpDisabled={stagedIndex <= 0}
	moveDownDisabled={stagedIndex >= $hearthConfig.rooms.length - 1}
	onduplicate={id ? duplicate : undefined}
>
	<TextField
		label={$lang('name')}
		required
		bind:value={name}
		placeholder={$lang('hearth_example_page_name')}
	/>
	<IconField label={$lang('icon')} bind:value={icon} placeholder="meeting_room" />
	<TextField
		label={$lang('summary')}
		bind:value={summary}
		placeholder={$lang('hearth_example_page_summary')}
	/>
	<EntityField
		label={$lang('hearth_temperature_sensor')}
		bind:value={tempEntity}
		domains={['sensor']}
		deviceClass="temperature"
	/>
	<EntityField
		label={$lang('hearth_humidity_sensor')}
		bind:value={humidityEntity}
		domains={['sensor']}
		deviceClass="humidity"
	/>
	<SelectField
		label={$lang('hearth_screen_height')}
		bind:value={fillScreen}
		options={[
			{ value: 'scroll', label: $lang('hearth_scrollable_default') },
			{ value: 'fill', label: $lang('hearth_fill_the_screen') }
		]}
		hint={fillScreen === 'fill' ? $lang('hearth_media_and_sensor_cards_without_a') : undefined}
	/>
	<SelectField
		label={$lang('hearth_page_columns')}
		bind:value={columns}
		options={[
			{ value: '', label: $lang('auto') },
			{ value: '1', label: $lang('hearth_one_column') },
			{ value: '2', label: fill($lang('hearth_columns_count'), { count: 2 }) },
			{ value: '3', label: fill($lang('hearth_columns_count'), { count: 3 }) }
		]}
	/>

	<CheckField label={$lang('hearth_hide_page_header')} bind:checked={hideHeader} />
	<div class="field-hint">
		{$lang('hearth_everything_on_the_page_is_a')}
		{#if id && $hearthConfig.rooms.length === 1}
			{$lang('hearth_this_is_the_last_page_so')}
		{/if}
	</div>

	<VisibilitySection bind:value={visibility} />
	<div class="field-hint">{$lang('hearth_page_visibility_hint')}</div>

	<FormSection title={$lang('hearth_page_look')}>
		<SelectField
			label={$lang('theme')}
			bind:value={pageTheme}
			options={withCurrent(
				[
					{ value: '', label: $lang('hearth_page_theme_default') },
					...themeOptions($lang, $savedThemes)
				],
				pageTheme,
				$lang
			)}
			hint={$lang('hearth_page_theme_hint')}
		/>
		<ImageField
			label={$lang('hearth_background_image')}
			bind:value={backgroundImage}
			issue={backgroundIssue}
			placeholder={$lang('hearth_example_background_image')}
		/>
		{#if backgroundImage.trim()}
			<SelectField
				label={$lang('hearth_background_scrim')}
				bind:value={backgroundScrim}
				options={(['light', 'medium', 'strong'] as const).map((level) => ({
					value: level,
					label: $lang(`hearth_scrim_${level}`)
				}))}
				hint={$lang('hearth_page_scrim_hint')}
			/>
		{/if}
	</FormSection>
</EditSheet>
