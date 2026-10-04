<script lang="ts">
	import LoadingState from './LoadingState.svelte';
	import { get } from 'svelte/store';
	import { ICON } from './iconSizes';
	import { connection } from '$lib/core/ha/connection';
	import { lang, fill } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from './config';
	import Icon from './Icon.svelte';
	import CheckField from './edit/CheckField.svelte';
	import EditSheet from './edit/EditSheet.svelte';
	import TabletStep from './TabletStep.svelte';
	import './buttons.css';
	import { applyNow } from './applyNow';
	import type { HassEntities } from 'home-assistant-js-websocket';
	import { applyImport, existingPageFor, newEntityIds, type ImportMode } from './importPlan';
	import { buildProposal, type HearthProposal, type ProposedPage } from './proposal';
	import {
		applyStarter,
		buildStarter,
		STARTER_LAYOUTS,
		type StarterId,
		type StarterPlan
	} from './starterLayouts';
	import { fetchRegistry, type RegistrySnapshot } from '$lib/core/ha/registry';
	import {
		editor,
		hearthConfig,
		hearthNeedsSetup,
		requestConfirmation,
		setupWizardSource
	} from './store';

	/** `firstRun` opened itself on an empty dashboard, so a stray backdrop tap must not dismiss it. */
	let { onclose, firstRun = false }: { onclose: () => void; firstRun?: boolean } = $props();

	let status = $state<'disconnected' | 'loading' | 'error' | 'ready'>('loading');
	let errorMessage = $state('');
	let registry = $state.raw<RegistrySnapshot | null>(null);
	// the states the proposal was built from, so the plans hold still while
	// entities change under them
	let loadedStates = $state.raw<HassEntities>({});
	let busy = $state(false);
	let proposal = $state<HearthProposal | null>(null);
	let included = $state<Record<string, boolean>>({});
	let includeGlanceables = $state(true);
	let mode = $state<ImportMode>('replace');
	let source = $state(get(setupWizardSource));
	let starter = $state<StarterId>('kitchen');
	// once the dashboard holds the result, the wizard ends on the tablet address
	let step = $state<'choose' | 'tablet'>('choose');

	// pages past the first one are what a replace would overwrite
	let replacedCount = $derived(Math.max(0, $hearthConfig.rooms.length - 1));

	/** Pages whose area already has a dashboard page, by its name or an alias. */
	function isExisting(page: ProposedPage) {
		return existingPageFor($hearthConfig.rooms, page) !== undefined;
	}

	let hasExisting = $derived(proposal?.pages.some(isExisting) ?? false);

	/** How many of each area's entities its existing page does not show yet. */
	let newCounts = $derived.by(() => {
		const known = Object.keys(loadedStates);
		return new Map(
			(proposal?.pages ?? []).map((page) => {
				const room = existingPageFor($hearthConfig.rooms, page);
				return [page.room.id, room ? newEntityIds(room, page, known).length : 0];
			})
		);
	});

	function selectable(page: ProposedPage) {
		if (mode === 'replace' || !isExisting(page)) return true;
		return mode === 'merge' && (newCounts.get(page.room.id) ?? 0) > 0;
	}

	let selectablePages = $derived(proposal?.pages.filter(selectable) ?? []);
	let includedCount = $derived(selectablePages.filter((page) => included[page.room.id]).length);
	let glanceableCount = $derived(
		proposal?.glanceables.filter((widget) => widget.type !== 'label').length ?? 0
	);

	let starterPlans = $derived.by((): Partial<Record<StarterId, StarterPlan>> => {
		if (!proposal || !registry) return {};
		const plain = $state.snapshot(proposal) as HearthProposal;
		const snapshot = registry;
		return Object.fromEntries(
			STARTER_LAYOUTS.map((layout) => [
				layout.id,
				buildStarter(layout.id, plain, snapshot, loadedStates)
			])
		);
	});
	let starterPlan = $derived(starterPlans[starter]);

	let canApply = $derived(
		source === 'starter'
			? Boolean(starterPlan?.pages.length)
			: includedCount > 0 || (includeGlanceables && glanceableCount > 0)
	);

	const MODES: [ImportMode, string][] = [
		['add', 'hearth_import_mode_add'],
		['merge', 'hearth_import_mode_merge'],
		['replace', 'hearth_import_mode_replace']
	];

	let modes = $derived(
		MODES.filter(
			([value]) =>
				value === 'add' ||
				(value === 'merge' && hasExisting) ||
				(value === 'replace' && replacedCount > 0)
		)
	);

	const MODE_NOTES: Record<ImportMode, string> = {
		add: 'hearth_import_keeps_pages',
		merge: 'hearth_import_merges_pages',
		replace: 'hearth_import_replaces_pages'
	};

	async function load() {
		if (!$connection) {
			status = 'disconnected';
			return;
		}
		status = 'loading';
		try {
			const snapshot = await fetchRegistry();
			registry = snapshot;
			loadedStates = get(states) ?? {};
			proposal = buildProposal(snapshot, loadedStates);
			// an untouched dashboard has nothing worth keeping; one the user has
			// already built on defaults to leaving those pages alone
			mode = replacedCount > 0 || proposal.pages.some(isExisting) ? 'add' : 'replace';
			selectAll(true);
			includeGlanceables = proposal.glanceables.length > 0;
			status = 'ready';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			status = 'error';
		}
	}

	load();

	// First-run discovery can mount before the Home Assistant socket connects.
	// Resume automatically once it becomes available instead of leaving the
	// user on a dead-end disconnected message.
	$effect(() => {
		if ($connection && status === 'disconnected') load();
	});

	function selectAll(value: boolean) {
		if (!proposal) return;
		included = Object.fromEntries(
			proposal.pages.map((page) => [page.room.id, value && selectable(page)])
		);
	}

	function count(value: number, one: string, many: string) {
		return fill($lang(value === 1 ? one : many), { count: String(value) });
	}

	const SUMMARY_KEYS: [keyof ProposedPage['counts'], string, string][] = [
		['lights', 'hearth_one_light', 'hearth_n_lights'],
		['covers', 'hearth_one_cover', 'hearth_n_covers'],
		['climate', 'hearth_one_thermostat', 'hearth_n_thermostats'],
		['media', 'hearth_one_media_player', 'hearth_n_media_players'],
		['cameras', 'hearth_one_camera', 'hearth_n_cameras'],
		['devices', 'hearth_one_device', 'hearth_n_devices']
	];

	function summarize(page: ProposedPage) {
		if (mode === 'merge' && isExisting(page)) {
			const fresh = newCounts.get(page.room.id) ?? 0;
			return count(fresh, 'hearth_one_new_entity', 'hearth_n_new_entities');
		}
		return SUMMARY_KEYS.filter(([key]) => page.counts[key] > 0)
			.map(([key, one, many]) => count(page.counts[key], one, many))
			.join(', ');
	}

	function summarizeStarter(plan: StarterPlan | undefined) {
		if (!plan?.pages.length) return $lang('hearth_starter_nothing');
		return plan.pages.map((page) => page.room.name).join(', ');
	}

	/*
	 * The tablet step follows only once the dashboard holds the result. A
	 * save that failed went to the edit bar, which the wizard would cover;
	 * a change declined for a newer revision leaves the wizard as it was.
	 */
	async function finish(mutate: Parameters<typeof applyNow>[0]) {
		busy = true;
		const outcome = await applyNow(mutate, () => {
			hearthNeedsSetup.set(false);
			// opened from the settings sheet, which would otherwise cover the new pages
			editor.set(null);
		});
		busy = false;
		if (outcome === 'applied') step = 'tablet';
		else if (outcome === 'unsaved') onclose();
	}

	function runImport() {
		if (!proposal) return;
		// unwrap the $state proxies - the config store gets structuredCloned on
		// every later mutation and proxies cannot be structured-cloned
		const plain = $state.snapshot(proposal) as HearthProposal;
		const chosen = plain.pages.filter((page) => included[page.room.id]);
		finish((config) =>
			applyImport(config, {
				pages: chosen,
				glanceables: includeGlanceables ? plain.glanceables : [],
				mode,
				known: Object.keys(loadedStates)
			})
		);
	}

	function apply() {
		if (source === 'starter') {
			const plan = starterPlan;
			if (plan) finish((config) => applyStarter(config, structuredClone(plan)));
			return;
		}
		if (mode === 'replace' && replacedCount > 0) {
			requestConfirmation({
				title: $lang('hearth_setup'),
				message: fill($lang('hearth_import_replace_confirm'), { count: String(replacedCount) }),
				confirmLabel: $lang('hearth_apply'),
				action: runImport
			});
			return;
		}
		runImport();
	}
</script>

{#if step === 'tablet'}
	<EditSheet
		title={$lang('hearth_tablet_title')}
		{onclose}
		ondone={onclose}
		doneLabel={$lang('done')}
	>
		<div class="wizard">
			<TabletStep />
		</div>
	</EditSheet>
{:else}
	<EditSheet
		title={$lang(source === 'starter' ? 'hearth_starter_layouts' : 'hearth_setup')}
		{onclose}
		ondone={apply}
		doneLabel={$lang('hearth_apply')}
		doneDisabled={status !== 'ready' || !canApply || busy}
		dismissible={!firstRun}
	>
		<div class="wizard">
			<div class="modes" role="radiogroup" aria-label={$lang('hearth_setup_source')}>
				{#each [['areas', 'hearth_setup_source_areas'], ['starter', 'hearth_setup_source_starter']] as [value, label] (value)}
					<button
						type="button"
						role="radio"
						class="mode pressable"
						aria-checked={source === value}
						class:selected={source === value}
						use:Ripple={PRESS_RIPPLE}
						onclick={() => (source = value as 'areas' | 'starter')}
					>
						{$lang(label)}
					</button>
				{/each}
			</div>
			<p class="intro">
				{$lang(source === 'starter' ? 'hearth_starter_intro' : 'hearth_import_intro')}
			</p>
			{#if status === 'disconnected'}
				<div class="hint">{$lang('hearth_not_connected')}</div>
			{:else if status === 'loading'}
				<LoadingState text={$lang('hearth_loading_registries')} />
			{:else if status === 'error'}
				<div class="hint">
					<div class="error" role="alert">
						<strong>{$lang('hearth_registries_failed')}</strong>
						<span class="error-detail">{errorMessage}</span>
					</div>
					<button
						type="button"
						class="hearth-button secondary pressable"
						use:Ripple={PRESS_RIPPLE}
						onclick={load}>{$lang('hearth_retry')}</button
					>
				</div>
			{:else if proposal && source === 'starter'}
				<div class="list" role="radiogroup" aria-label={$lang('hearth_starter_layouts')}>
					{#each STARTER_LAYOUTS as layout (layout.id)}
						<button
							type="button"
							role="radio"
							class="row starter pressable"
							aria-checked={starter === layout.id}
							class:selected={starter === layout.id}
							onclick={() => (starter = layout.id)}
						>
							<span class="row-content">
								<span class="row-icon"><Icon name={layout.icon} size={ICON.control} /></span>
								<span class="row-text">
									<span class="row-name">{$lang(layout.name)}</span>
									<span class="row-summary">{$lang(layout.sub)}</span>
									<span class="row-summary">{summarizeStarter(starterPlans[layout.id])}</span>
								</span>
								<span class="row-check">
									{#if starter === layout.id}<Icon name="check" size={ICON.control} />{/if}
								</span>
							</span>
						</button>
					{/each}
				</div>
			{:else if proposal}
				{#if modes.length > 1}
					<div class="modes" role="radiogroup" aria-label={$lang('hearth_import_mode')}>
						{#each modes as [value, label] (value)}
							<button
								type="button"
								role="radio"
								class="mode pressable"
								aria-checked={mode === value}
								class:selected={mode === value}
								use:Ripple={PRESS_RIPPLE}
								onclick={() => {
									mode = value;
									selectAll(true);
								}}
							>
								{$lang(label)}
							</button>
						{/each}
					</div>
					<p class="mode-note">
						{fill($lang(MODE_NOTES[mode]), { count: String(replacedCount) })}
					</p>
				{/if}
				{#if proposal.glanceables.length}
					<div class="row glanceables">
						<CheckField label={$lang('hearth_today_glanceables')} bind:checked={includeGlanceables}>
							<span class="row-content">
								<span class="row-icon"><Icon name="today" size={ICON.control} /></span>
								<span class="row-text">
									<span class="row-name">{$lang('hearth_today_glanceables')}</span>
									<span class="row-summary"
										>{count(glanceableCount, 'hearth_one_suggestion', 'hearth_n_suggestions')}</span
									>
								</span>
							</span>
						</CheckField>
					</div>
				{/if}
				{#if selectablePages.length > 1}
					<div class="bulk">
						<button type="button" class="link" onclick={() => selectAll(true)}
							>{$lang('hearth_select_all')}</button
						>
						<button type="button" class="link" onclick={() => selectAll(false)}
							>{$lang('none')}</button
						>
					</div>
				{/if}
				<div class="list">
					{#each selectablePages as page, index (page.room.id)}
						{#if page.floorName && page.floorName !== selectablePages[index - 1]?.floorName}
							<div class="floor">{page.floorName}</div>
						{/if}
						<div class="row">
							<CheckField label={page.room.name} bind:checked={included[page.room.id]}>
								<span class="row-content">
									<span class="row-icon"><Icon name={page.room.icon} size={ICON.control} /></span>
									<span class="row-text">
										<span class="row-name">{page.room.name}</span>
										<span class="row-summary">{summarize(page)}</span>
									</span>
								</span>
							</CheckField>
						</div>
					{:else}
						<div class="hint">
							{mode !== 'replace' && proposal.pages.length
								? $lang(mode === 'merge' ? 'hearth_no_new_entities' : 'hearth_no_new_areas')
								: $lang('hearth_no_areas')}
						</div>
					{/each}
				</div>
			{/if}
			{#if firstRun}
				<button
					type="button"
					class="hearth-button secondary skip pressable"
					use:Ripple={PRESS_RIPPLE}
					onclick={onclose}>{$lang('hearth_skip_for_now')}</button
				>
			{/if}
		</div>
	</EditSheet>
{/if}

<style>
	.wizard {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
	}

	.skip {
		align-self: flex-end;
		margin-top: 14px;
	}

	.modes {
		display: flex;
		gap: 6px;
		padding: 4px;
		border-radius: var(--h-radius-sm);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
	}

	.mode {
		flex: 1;
		padding: 8px 12px;
		border: 0;
		border-radius: var(--h-radius-xs);
		background: none;
		color: var(--h-text-4);
		font-family: inherit;
		font-size: var(--h-type-secondary);
		font-weight: 600;
		cursor: pointer;
	}

	.mode.selected {
		background: rgb(var(--h-surface-rgb) / calc(0.12 * var(--h-fill-scale)));
		color: var(--h-text-2);
	}

	.mode-note {
		margin: 8px 2px 4px;
		font-size: var(--h-type-small);
		color: var(--h-text-5);
	}

	.bulk {
		display: flex;
		justify-content: flex-end;
		gap: 14px;
		padding: 6px 10px 2px;
	}

	.link {
		border: 0;
		background: none;
		padding: 0;
		color: var(--h-text-5);
		font-family: inherit;
		font-size: var(--h-type-small);
		cursor: pointer;
	}

	@media (hover: hover) {
		.link:hover {
			color: var(--h-text-3);
		}
	}

	.floor {
		padding: 10px 10px 4px;
		font-size: var(--h-type-small);
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--h-text-6);
	}
	.intro {
		margin: 10px 0 14px;
		font-size: var(--h-type-secondary);
		line-height: 1.5;
		color: var(--h-text-4);
	}

	.list {
		margin: 0 -6px;
		padding: 0 6px;
	}

	.row {
		padding: 2px 10px;
		border-radius: var(--h-radius-xs);
	}

	.row.starter {
		display: block;
		width: 100%;
		padding: 10px;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.row.starter.selected {
		background: rgb(var(--h-accent-rgb) / calc(0.12 * var(--h-accent-scale)));
	}

	.row-check {
		display: flex;
		width: 20px;
		color: var(--h-accent-text);
	}

	/* the rows sit in a list; the field's own spacing is for forms */
	.row :global(.field) {
		margin: 0;
	}

	.row-content {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	@media (hover: hover) {
		.row:hover {
			background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		}
	}

	.row-icon {
		display: flex;
		color: var(--h-icon);
	}

	.row-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.row-name {
		font-size: var(--h-type-body);
		color: var(--h-text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-summary {
		font-size: var(--h-type-small);
		color: var(--h-text-5);
	}

	.hint {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 24px 10px;
		font-size: var(--h-type-secondary);
		color: var(--h-text-6);
		text-align: center;
	}

	.error {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: var(--h-bad-text);
	}

	.error-detail {
		font-size: var(--h-type-small);
		color: var(--h-text-5);
		overflow-wrap: anywhere;
	}
</style>
