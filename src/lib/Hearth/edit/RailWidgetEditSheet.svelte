<script lang="ts">
	import { ICON } from '../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { get } from 'svelte/store';
	import { untrack } from 'svelte';
	import Ripple from '$lib/ui/actions/ripple';
	import { activateOnKeyboard } from '../interaction';
	import type { MobileSlot, RailSide, RailWidget, VisibilityCondition } from '../types';
	import { moveRailWidget, moveToSide } from '../model/railMoves';
	import { duplicateRailWidget } from '../model/layoutEdits';
	import {
		normalizeVisibility,
		PRESS_RIPPLE,
		railPositionOf,
		railSideOf,
		slugify,
		uniqueId
	} from '../config';
	import { RAIL_WIDGET_TYPES, widgetDescriptor, type WidgetDraft } from '../widgets';
	import { editor, hearthConfig, offerUndo, updateConfig } from '../store';
	import { confirmDiscard } from './discard';
	import EditSheet from './EditSheet.svelte';
	import Icon from '../Icon.svelte';
	import TypeGallery from './TypeGallery.svelte';
	import RailWidgetRenderer from '../RailWidgetRenderer.svelte';
	import PreviewPane from './PreviewPane.svelte';
	import VisibilitySection from './VisibilitySection.svelte';

	let { index, side: addedFrom }: { index: number | null; side?: RailSide } = $props();

	// initial value only - the sheet is remounted per editor target via {#key}
	// svelte-ignore state_referenced_locally
	const initial = index !== null ? get(hearthConfig).rail[index] : undefined;

	let type = $state<RailWidget['type']>(initial?.type ?? 'status');
	// undefined is the automatic slot: the rail's own flexible gap decides
	let mobile = $state<MobileSlot | undefined>(
		initial?.mobile ?? (initial?.hide_mobile ? 'hidden' : undefined)
	);
	// svelte-ignore state_referenced_locally
	let side = $state<RailSide>(initial ? railSideOf(initial) : (addedFrom ?? 'left'));
	let visibility = $state<VisibilityCondition[]>(
		(initial?.visibility ?? []).map((condition) => ({ ...condition }))
	);
	// svelte-ignore state_referenced_locally
	let typeOpen = $state(index === null);
	let draft = $state<WidgetDraft<RailWidget>>({ fields: {} as WidgetDraft<RailWidget>['fields'] });

	let descriptor = $derived(widgetDescriptor(type));
	let twoRails = $derived(railPositionOf($hearthConfig) === 'both');

	// header moves are staged with the rest and applied on Done
	let moveBy = $state(0);
	// the widget's place among its neighbours before the staged steps: with
	// two rails only its own side counts, and a widget sent to the other side
	// lands at the end of it
	let position = $derived.by(() => {
		const rail = $hearthConfig.rail;
		if (!initial) return { index: 0, length: 1 };
		if (twoRails && railSideOf(initial) !== side) {
			const landing = rail.filter(
				(widget) => widget.id !== initial.id && railSideOf(widget) === side
			).length;
			return { index: landing, length: landing + 1 };
		}
		const neighbours = twoRails ? rail.filter((widget) => railSideOf(widget) === side) : rail;
		return {
			index: neighbours.findIndex((widget) => widget.id === initial.id),
			length: neighbours.length
		};
	});
	let stagedIndex = $derived(position.index + moveBy);
	let editorInitial = $derived(initial?.type === type ? initial : undefined);

	const MOBILE_CHOICES = [
		{ slot: undefined, label: 'hearth_mobile_auto', icon: 'auto_awesome' },
		{ slot: 'top', label: 'hearth_mobile_above_page', icon: 'vertical_align_top' },
		{ slot: 'bottom', label: 'hearth_mobile_below_page', icon: 'vertical_align_bottom' },
		{ slot: 'hidden', label: 'hearth_hide_on_mobile', icon: 'smartphone' }
	] as const;

	const SIDE_CHOICES = [
		{ side: 'left', label: 'hearth_left_sidebar', icon: 'dock_to_left' },
		{ side: 'right', label: 'hearth_right_sidebar', icon: 'dock_to_right' }
	] as const;

	function close() {
		editor.set(null);
	}

	function buildWidget(id: string): RailWidget {
		// unknown extension keys survive a no-op edit; a type switch starts fresh
		const fields = {
			...(initial?.type === type ? initial : {}),
			...$state.snapshot(draft.fields)
		};
		return {
			...fields,
			// the editor loads on demand; normalizing gives the preview typed
			// defaults until it reports its fields
			...(descriptor.normalize?.(fields) ?? {}),
			id,
			type,
			mobile,
			// superseded by `mobile`; a saved widget never carries both
			hide_mobile: undefined,
			side: side === 'right' ? 'right' : undefined,
			visibility: normalizeVisibility($state.snapshot(visibility))
		} as RailWidget;
	}

	let previewWidget = $derived.by(() => buildWidget('preview'));

	/*
	 * An options editor loads on demand and reports its fields once on mount,
	 * before any input, so that first report is its untouched form. A new
	 * widget starts over with each type picked; an existing one counts a type
	 * switch as a change.
	 */
	function placement() {
		return JSON.stringify({ mobile, side, visibility, moveBy });
	}
	const untouchedPlacement = placement();
	let untouchedType = $state(initial?.type ?? 'status');
	let untouchedFields = $state<string>();
	let dirty = $derived(
		type !== untouchedType ||
			placement() !== untouchedPlacement ||
			(untouchedFields !== undefined && JSON.stringify(draft.fields) !== untouchedFields)
	);

	function report(next: WidgetDraft<RailWidget>) {
		draft = next;
		// runs inside the editor's effect, which must not come to depend on the sheet's state
		untrack(() => (untouchedFields ??= JSON.stringify(next.fields)));
	}

	// moving the widget shifts its index, so later writes find it by id
	function widgetIndex(rail: RailWidget[]) {
		return initial ? rail.findIndex((widget) => widget.id === initial.id) : -1;
	}

	function done() {
		updateConfig((config) => {
			let id: string;
			if (initial) {
				id = initial.id;
				const position = widgetIndex(config.rail);
				if (position >= 0) config.rail[position] = buildWidget(id);
			} else {
				id = uniqueId(
					slugify(type),
					config.rail.map((widget) => widget.id)
				);
				config.rail.push(buildWidget(id));
			}
			// a new widget, or one sent to the other rail, goes to the end of its rail
			const sideChanged = !initial || railSideOf(initial) !== side;
			if (twoRails && sideChanged) config.rail = moveToSide(config.rail, id, side);
			for (let step = 0; step < Math.abs(moveBy); step += 1) {
				moveRailWidget(
					config.rail,
					widgetIndex(config.rail),
					moveBy < 0 ? -1 : 1,
					railPositionOf(config)
				);
			}
		});
		close();
	}

	function remove() {
		updateConfig((config) => {
			const position = widgetIndex(config.rail);
			if (position >= 0) config.rail.splice(position, 1);
		});
		close();
		offerUndo($lang('hearth_widget_removed'));
	}

	function chooseSide(next: RailSide) {
		if (next !== side) moveBy = 0;
		side = next;
	}

	function move(delta: -1 | 1) {
		const next = Math.max(0, Math.min(position.length - 1, stagedIndex + delta));
		moveBy = next - position.index;
	}

	// copies the widget as saved and opens the copy, so a staged edit is dropped first
	function duplicate() {
		confirmDiscard(dirty, () => {
			let copyIndex: number | undefined;
			updateConfig((config) => {
				copyIndex = duplicateRailWidget(config.rail, widgetIndex(config.rail));
			});
			if (copyIndex !== undefined) editor.set({ kind: 'railWidget', index: copyIndex });
		});
	}
</script>

<EditSheet
	title={$lang(index !== null ? 'hearth_edit_widget' : 'hearth_add_widget')}
	onclose={close}
	ondone={done}
	{dirty}
	doneDisabled={typeOpen || draft.valid === false}
	doneReason={!typeOpen && draft.valid === false
		? (draft.reason ?? $lang('hearth_fix_marked_fields'))
		: null}
	onremove={initial ? remove : undefined}
	onmoveup={initial ? () => move(-1) : undefined}
	onmovedown={initial ? () => move(1) : undefined}
	moveUpDisabled={stagedIndex <= 0}
	moveDownDisabled={stagedIndex >= position.length - 1}
	onduplicate={initial ? duplicate : undefined}
	confirmRemove={false}
	wide
>
	<TypeGallery
		kinds={RAIL_WIDGET_TYPES}
		selected={type}
		label="hearth_widget_type"
		searchPlaceholder={$lang('hearth_search_widgets')}
		noMatch={$lang('hearth_no_widgets_match')}
		bind:open={typeOpen}
		onselect={(value) => {
			if (index === null && value !== type) {
				untouchedType = value as RailWidget['type'];
				untouchedFields = undefined;
			}
			type = value as RailWidget['type'];
			// option-free types have no editor to replace a stale draft
			draft = { fields: {} as WidgetDraft<RailWidget>['fields'] };
		}}
	/>
	<div class="rail-editor editor-layout" class:hidden={typeOpen}>
		<div class="config editor-fields">
			{#key type}
				{#if descriptor.editor}
					{#await descriptor.editor() then Editor}
						<Editor.default initial={editorInitial} onchange={report} />
					{:catch}
						<div class="field-error">{$lang('hearth_could_not_load_component')}</div>
					{/await}
				{/if}
			{/key}

			<VisibilitySection
				bind:value={visibility}
				hiddenElsewhere={mobile === 'hidden'}
				onalwaysvisible={() => {
					if (mobile === 'hidden') mobile = undefined;
				}}
			/>

			{#if twoRails}
				<div class="group-label">{$lang('hearth_widget_side')}</div>
				<div class="chips">
					{#each SIDE_CHOICES as choice (choice.side)}
						<span
							class="chip pressable"
							class:active={side === choice.side}
							use:Ripple={PRESS_RIPPLE}
							role="button"
							tabindex="0"
							aria-pressed={side === choice.side}
							onclick={() => chooseSide(choice.side)}
							onkeydown={(event) => activateOnKeyboard(event, () => chooseSide(choice.side))}
						>
							<Icon name={choice.icon} size={ICON.inline} />
							{$lang(choice.label)}
						</span>
					{/each}
				</div>
			{/if}

			<div class="group-label">{$lang('hearth_on_mobile')}</div>
			<div class="chips">
				{#each MOBILE_CHOICES as choice (choice.label)}
					<span
						class="chip pressable"
						class:active={mobile === choice.slot}
						use:Ripple={PRESS_RIPPLE}
						role="button"
						tabindex="0"
						aria-pressed={mobile === choice.slot}
						onclick={() => (mobile = choice.slot)}
						onkeydown={(event) => activateOnKeyboard(event, () => (mobile = choice.slot))}
					>
						<Icon name={choice.icon} size={ICON.inline} />
						{$lang(choice.label)}
					</span>
				{/each}
			</div>
			{#if mobile === undefined}
				<div class="hint">{$lang('hearth_mobile_auto_hint')}</div>
			{/if}
		</div>
		<PreviewPane>
			{#if previewWidget.type === 'spacer' && !previewWidget.height && !previewWidget.line}
				<div class="preview-note">{$lang('hearth_flexible_gap_pushes_the_widgets_around')}</div>
			{:else}
				<RailWidgetRenderer widget={previewWidget} />
			{/if}
		</PreviewPane>
	</div>
</EditSheet>

<style>
	.rail-editor {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(280px, 0.7fr);
		align-items: start;
		gap: 28px;
	}

	.rail-editor.hidden {
		display: none;
	}

	.config {
		min-width: 0;
	}

	.preview-note {
		font-size: var(--h-type-secondary);
		color: var(--h-text-4);
		text-align: center;
	}

	/* see breakpoints.ts */
	@media (max-width: 900px) {
		.rail-editor {
			grid-template-columns: 1fr;
			gap: 18px;
		}
	}
</style>
