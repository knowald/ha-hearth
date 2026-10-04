<script lang="ts">
	import { integerFromInput } from './numbers';
	import { fill as fillText, lang } from '$lib/core/i18n';
	import { get } from 'svelte/store';
	import { untrack } from 'svelte';
	import type {
		EntityRef,
		HearthConfig,
		OverviewCard,
		OverviewItem,
		VisibilityCondition
	} from '../types';
	import {
		ensureRoomCardColumns,
		findOverviewCard,
		findOverviewItemList,
		isStack,
		normalizeVisibility,
		slugify,
		takenCardIds,
		uniqueId
	} from '../config';
	import { CARD_TYPES, cardDescriptor, type CardDraft } from '../cards';
	import {
		cardColumnIndex,
		duplicateOverviewItem,
		moveOverviewItem,
		roomColumnCount,
		shiftItem
	} from '../model/layoutEdits';
	import { editor, hearthConfig, offerUndo, updateConfig } from '../store';
	import { confirmDiscard } from './discard';
	import CardPreview from './CardPreview.svelte';
	import EditSheet from './EditSheet.svelte';
	import FormSection from './FormSection.svelte';
	import TypeGallery from './TypeGallery.svelte';
	import SelectField from './SelectField.svelte';
	import TextField from './TextField.svelte';
	import VisibilitySection from './VisibilitySection.svelte';

	let {
		roomId,
		id,
		column,
		stackId
	}: { roomId: string; id: string | null; column?: number; stackId?: string } = $props();

	// `column` indexes into the page's card columns; they are initialized on
	// first write via ensureRoomCardColumns in done()
	function containerColumns(config: HearthConfig): OverviewItem[][] | undefined {
		return config.rooms.find((entry) => entry.id === roomId)?.cards;
	}

	function stackCards(config: HearthConfig, targetStackId: string): OverviewCard[] | undefined {
		if (column === undefined) return undefined;
		const target = containerColumns(config)?.[column]?.find((item) => item.id === targetStackId);
		return target && isStack(target) ? target.cards : undefined;
	}

	function insertionList(config: HearthConfig): OverviewCard[] | undefined {
		if (column === undefined) return undefined;
		if (stackId !== undefined) return stackCards(config, stackId);
		return containerColumns(config)?.[column] as OverviewCard[] | undefined;
	}

	// initial value only - the sheet is remounted per editor target via {#key}
	// svelte-ignore state_referenced_locally
	const initial = id !== null ? findOverviewCard(get(hearthConfig), id, roomId) : undefined;

	let type = $state<OverviewCard['type']>(initial?.type ?? 'entities');
	// a new card opens on the gallery; an existing one on its fields
	// svelte-ignore state_referenced_locally
	let typeOpen = $state(id === null);
	// blank means the type's own default: media and sensor cards fill, the rest
	// size to their content
	let fill = $state<string>(
		initial && typeof initial.fill === 'number' ? String(initial.fill) : ''
	);
	// A blank height uses the card descriptor’s default sizing.
	let height = $state<string>(
		initial && 'height' in initial && initial.height ? String(initial.height) : ''
	);
	let visibility = $state<VisibilityCondition[]>(
		(initial?.visibility ?? []).map((condition) => ({ ...condition }))
	);

	/*
	 * Where an existing card goes on Done: another page, another column, and
	 * how many places it moves from where it lands. All staged, so Cancel
	 * leaves the card where it was.
	 */
	const startRoom = get(hearthConfig).rooms.find((entry) => entry.id === roomId);
	// svelte-ignore state_referenced_locally
	const startColumn = Math.max(0, id !== null && startRoom ? cardColumnIndex(startRoom, id) : 0);
	// svelte-ignore state_referenced_locally
	let targetPage = $state(roomId);
	let targetColumn = $state(String(startColumn));
	let moveBy = $state(0);
	let relocated = $derived(targetPage !== roomId || Number(targetColumn) !== startColumn);

	let pageOptions = $derived(
		$hearthConfig.rooms.map((entry) => ({ value: entry.id, label: entry.name || entry.id }))
	);
	let targetColumns = $derived.by(() => {
		const target = $hearthConfig.rooms.find((entry) => entry.id === targetPage);
		return target ? roomColumnCount(target) : 1;
	});
	let columnOptions = $derived(
		Array.from({ length: targetColumns }, (_, index) => ({
			value: String(index),
			label: fillText($lang('hearth_column_number'), { number: index + 1 })
		}))
	);

	// the card's place before the staged steps: where it is, or the end of
	// the column it is being sent to
	let position = $derived.by(() => {
		if (id === null) return { index: 0, length: 1 };
		if (!relocated) {
			const list = findOverviewItemList($hearthConfig, id, roomId) ?? [];
			return { index: list.findIndex((item) => item.id === id), length: list.length };
		}
		const target = $hearthConfig.rooms.find((entry) => entry.id === targetPage);
		const landing = target?.cards?.[Number(targetColumn)]?.length ?? 0;
		return { index: landing, length: landing + 1 };
	});
	let stagedIndex = $derived(position.index + moveBy);

	function choosePage(value: string) {
		targetColumn = String(value === roomId ? startColumn : 0);
		moveBy = 0;
	}

	// the per-type editor reports its fields; the shell adds id, type and layout
	let draft = $state<CardDraft<OverviewCard>>({ fields: {} as CardDraft<OverviewCard>['fields'] });
	let editorRef = $state<{ applyPreviewReorder?: (entities: EntityRef[]) => void }>();

	let descriptor = $derived(cardDescriptor(type));
	let editorInitial = $derived(initial?.type === type ? initial : undefined);

	function buildCard(cardId: string): OverviewCard {
		const heightValue = integerFromInput(height);
		const fillValue = fill === '' ? undefined : Number(fill);
		// Unknown extension keys survive a no-op form edit. Switching type starts
		// a new schema and intentionally leaves type-specific extensions behind.
		// snapshot: the draft is $state and its nested arrays are proxies,
		// which the store's structuredClone cannot copy
		const fields = {
			...(initial?.type === type ? initial : {}),
			...$state.snapshot(draft.fields)
		};
		return {
			...fields,
			// the editor loads on demand and reports its fields a beat after the
			// preview first renders; normalizing fills typed defaults until then
			...descriptor.normalize(fields),
			id: cardId,
			type,
			...(descriptor.sizable
				? { height: Number.isFinite(heightValue) && heightValue >= 40 ? heightValue : undefined }
				: {}),
			fill: Number.isFinite(fillValue as number) ? fillValue : undefined,
			visibility: normalizeVisibility($state.snapshot(visibility))
		} as OverviewCard;
	}

	let previewCard = $derived.by(() => buildCard('preview'));

	/*
	 * The per-type editor loads on demand and reports its fields once on
	 * mount, before any input, so that first report is its untouched form. A
	 * new card starts over with each type picked; an existing one counts a type
	 * switch as a change.
	 */
	function layout() {
		return JSON.stringify({ fill, height, visibility, targetPage, targetColumn, moveBy });
	}
	const untouchedLayout = layout();
	let untouchedType = $state(initial?.type ?? 'entities');
	let untouchedFields = $state<string>();
	let dirty = $derived(
		type !== untouchedType ||
			layout() !== untouchedLayout ||
			(untouchedFields !== undefined && JSON.stringify(draft.fields) !== untouchedFields)
	);

	function report(next: CardDraft<OverviewCard>) {
		draft = next;
		// runs inside the editor's effect, which must not come to depend on the sheet's state
		untrack(() => (untouchedFields ??= JSON.stringify(next.fields)));
	}

	function close() {
		editor.set(null);
	}

	function done() {
		updateConfig((config) => {
			const room = config.rooms.find((entry) => entry.id === roomId);
			if (room) ensureRoomCardColumns(room);
			if (id !== null) {
				const cards = findOverviewItemList(config, id, roomId);
				const targetIndex = cards?.findIndex((card) => card.id === id) ?? -1;
				if (!cards || targetIndex < 0) return;
				cards[targetIndex] = buildCard(id);
				if (relocated) moveOverviewItem(config, id, roomId, targetPage, Number(targetColumn));
				const landed = findOverviewItemList(config, id, targetPage);
				if (landed && moveBy) {
					shiftItem(
						landed,
						landed.findIndex((card) => card.id === id),
						moveBy
					);
				}
			} else {
				const cards = insertionList(config);
				if (!cards) return;
				cards.push(buildCard(uniqueId(slugify(type), takenCardIds(config))));
			}
		});
		close();
	}

	function remove() {
		updateConfig((config) => {
			if (id === null) return;
			const cards = findOverviewItemList(config, id, roomId);
			const targetIndex = cards?.findIndex((card) => card.id === id) ?? -1;
			if (cards && targetIndex >= 0) cards.splice(targetIndex, 1);
		});
		close();
		offerUndo($lang('hearth_card_removed'));
	}

	function move(delta: number) {
		const next = Math.max(0, Math.min(position.length - 1, stagedIndex + delta));
		moveBy = next - position.index;
	}

	// copies the card as saved and opens the copy, so a staged edit is dropped first
	function duplicate() {
		if (id === null) return;
		const source = id;
		confirmDiscard(dirty, () => {
			let copyId: string | undefined;
			updateConfig((config) => {
				copyId = duplicateOverviewItem(config, roomId, source);
			});
			if (copyId) editor.set({ kind: 'card', roomId, id: copyId });
		});
	}

	function selectType(value: string) {
		if (id === null && value !== type) {
			untouchedType = value as OverviewCard['type'];
			untouchedFields = undefined;
		}
		type = value as OverviewCard['type'];
		// the previous type's fields must not leak into the preview or the save
		draft = { fields: {} as CardDraft<OverviewCard>['fields'] };
	}
</script>

<EditSheet
	title={$lang(id !== null ? 'hearth_edit_card' : 'hearth_add_card')}
	onclose={close}
	ondone={done}
	{dirty}
	doneDisabled={typeOpen || draft.valid === false}
	doneReason={!typeOpen && draft.valid === false
		? (draft.reason ?? $lang('hearth_fix_marked_fields'))
		: null}
	onremove={id !== null ? remove : undefined}
	onmoveup={id !== null ? () => move(-1) : undefined}
	onmovedown={id !== null ? () => move(1) : undefined}
	moveUpDisabled={stagedIndex <= 0}
	moveDownDisabled={stagedIndex >= position.length - 1}
	onduplicate={id !== null ? duplicate : undefined}
	confirmRemove={false}
	wide
>
	<TypeGallery
		kinds={CARD_TYPES}
		selected={type}
		label="hearth_card_type"
		searchPlaceholder={$lang('hearth_search_cards')}
		noMatch={$lang('hearth_no_cards_match')}
		bind:open={typeOpen}
		onselect={selectType}
	/>
	<div class="card-editor-layout editor-layout" class:hidden={typeOpen}>
		<div class="card-settings editor-fields">
			<!-- keyed so a type switch mounts a fresh editor with fresh field state -->
			{#key type}
				{#await descriptor.editor() then Editor}
					<Editor.default bind:this={editorRef} initial={editorInitial} onchange={report} />
				{:catch}
					<div class="field-error">{$lang('hearth_could_not_load_component')}</div>
				{/await}
			{/key}

			<FormSection title={$lang('hearth_layout')}>
				<SelectField
					label={$lang('hearth_fill_leftover_height')}
					bind:value={fill}
					options={[
						{ value: '', label: $lang('hearth_fill_default') },
						{ value: '0', label: $lang('hearth_fill_none') },
						{ value: '1', label: $lang('hearth_fill_one') },
						{ value: '2', label: $lang('hearth_fill_double') },
						{ value: '3', label: $lang('hearth_fill_triple') }
					]}
					hint={$lang('hearth_cards_sharing_a_column_split_whatever')}
				/>

				{#if descriptor.sizable}
					<TextField
						label={$lang('hearth_height_in_px_optional')}
						bind:value={height}
						placeholder="240"
						inputmode="numeric"
						hint={$lang(descriptor.heightHint ?? 'hearth_height_hint_fill')}
					/>
				{/if}

				{#if id !== null}
					<SelectField
						label={$lang('hearth_page')}
						bind:value={targetPage}
						options={pageOptions}
						onchange={choosePage}
					/>
					{#if targetColumns > 1}
						<SelectField
							label={$lang('hearth_column')}
							bind:value={targetColumn}
							options={columnOptions}
							onchange={() => (moveBy = 0)}
						/>
					{/if}
				{/if}

				<VisibilitySection bind:value={visibility} />
			</FormSection>
		</div>

		<CardPreview
			card={previewCard}
			onentitiesreorder={descriptor.previewReorder
				? (entities) => editorRef?.applyPreviewReorder?.(entities)
				: undefined}
		/>
	</div>
</EditSheet>

<style>
	.card-editor-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(320px, 0.85fr);
		align-items: start;
		gap: 28px;
	}

	.card-settings {
		min-width: 0;
	}

	/* the open gallery is the whole sheet; fields and preview wait underneath */
	.card-editor-layout.hidden {
		display: none;
	}

	/* see breakpoints.ts */
	@media (max-width: 900px) {
		.card-editor-layout {
			grid-template-columns: 1fr;
			gap: 18px;
		}
	}
</style>
