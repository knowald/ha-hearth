<script lang="ts">
	import { ICON } from '../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { get } from 'svelte/store';
	import Ripple from '$lib/ui/actions/ripple';
	import { activateOnKeyboard } from '../interaction';
	import type { MobileSlot, RailWidget, VisibilityCondition } from '../types';
	import { moveItem, normalizeVisibility, PRESS_RIPPLE, slugify, uniqueId } from '../config';
	import { RAIL_WIDGET_TYPES, widgetDescriptor, type WidgetDraft } from '../widgets';
	import { editor, hearthConfig, updateConfig } from '../store';
	import EditSheet from './EditSheet.svelte';
	import Icon from '../Icon.svelte';
	import TypeGallery from './TypeGallery.svelte';
	import RailWidgetRenderer from '../RailWidgetRenderer.svelte';
	import PreviewPane from './PreviewPane.svelte';
	import VisibilitySection from './VisibilitySection.svelte';

	let { index }: { index: number | null } = $props();

	// initial value only - the sheet is remounted per editor target via {#key}
	// svelte-ignore state_referenced_locally
	const initial = index !== null ? get(hearthConfig).rail[index] : undefined;

	let type = $state<RailWidget['type']>(initial?.type ?? 'status');
	// undefined is the automatic slot: the rail's own flexible gap decides
	let mobile = $state<MobileSlot | undefined>(
		initial?.mobile ?? (initial?.hide_mobile ? 'hidden' : undefined)
	);
	let visibility = $state<VisibilityCondition[]>(
		(initial?.visibility ?? []).map((condition) => ({ ...condition }))
	);
	// svelte-ignore state_referenced_locally
	let typeOpen = $state(index === null);
	let draft = $state<WidgetDraft<RailWidget>>({ fields: {} as WidgetDraft<RailWidget>['fields'] });

	let descriptor = $derived(widgetDescriptor(type));
	let editorInitial = $derived(initial?.type === type ? initial : undefined);

	const MOBILE_CHOICES = [
		{ slot: undefined, label: 'hearth_mobile_auto', icon: 'auto_awesome' },
		{ slot: 'top', label: 'hearth_mobile_above_page', icon: 'vertical_align_top' },
		{ slot: 'bottom', label: 'hearth_mobile_below_page', icon: 'vertical_align_bottom' },
		{ slot: 'hidden', label: 'hearth_hide_on_mobile', icon: 'smartphone' }
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
			visibility: normalizeVisibility($state.snapshot(visibility))
		} as RailWidget;
	}

	let previewWidget = $derived.by(() => buildWidget('preview'));

	// moving the widget shifts its index, so later writes find it by id
	function widgetIndex(rail: RailWidget[]) {
		return initial ? rail.findIndex((widget) => widget.id === initial.id) : -1;
	}

	function done() {
		updateConfig((config) => {
			if (initial) {
				const position = widgetIndex(config.rail);
				if (position >= 0) config.rail[position] = buildWidget(initial.id);
			} else {
				const taken = config.rail.map((widget) => widget.id);
				config.rail.push(buildWidget(uniqueId(slugify(type), taken)));
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
	}

	function move(delta: number) {
		updateConfig((config) => moveItem(config.rail, widgetIndex(config.rail), delta));
	}
</script>

<EditSheet
	title={$lang(index !== null ? 'hearth_edit_widget' : 'hearth_add_widget')}
	onclose={close}
	ondone={done}
	doneDisabled={typeOpen || draft.valid === false}
	onremove={initial ? remove : undefined}
	onmoveup={initial ? () => move(-1) : undefined}
	onmovedown={initial ? () => move(1) : undefined}
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
						<Editor.default initial={editorInitial} onchange={(next) => (draft = next)} />
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
		color: var(--h-text-6);
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
