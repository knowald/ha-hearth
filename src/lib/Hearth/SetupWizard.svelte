<script lang="ts">
	import { get } from 'svelte/store';
	import { ICON } from './iconSizes';
	import { connection } from '$lib/core/ha/connection';
	import { lang, fill } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from './config';
	import Icon from './Icon.svelte';
	import { applyImport, existingPageNames, pageNameKey, type ImportMode } from './importPlan';
	import { buildProposal, type HearthProposal, type ProposedPage } from './proposal';
	import { fetchRegistry } from '$lib/core/ha/registry';
	import {
		enterEditMode,
		hearthConfig,
		hearthEditMode,
		hearthNeedsSetup,
		requestConfirmation,
		saveState,
		saveWithFeedback,
		updateConfig
	} from './store';
	import { layer } from '$lib/ui/layers';

	let { onclose }: { onclose: () => void } = $props();

	let status = $state<'disconnected' | 'loading' | 'error' | 'ready'>('loading');
	let errorMessage = $state('');
	let proposal = $state<HearthProposal | null>(null);
	let included = $state<Record<string, boolean>>({});
	let includeGlanceables = $state(true);
	let mode = $state<ImportMode>('replace');

	// pages past the first one are what a replace would overwrite
	let replacedCount = $derived(Math.max(0, $hearthConfig.rooms.length - 1));

	let existingNames = $derived(existingPageNames($hearthConfig));

	/** Pages whose area already has a dashboard page of the same name. */
	function isExisting(page: ProposedPage) {
		return existingNames.has(pageNameKey(page.room.name));
	}

	let selectablePages = $derived(
		proposal?.pages.filter((page) => mode === 'replace' || !isExisting(page)) ?? []
	);
	let includedCount = $derived(selectablePages.filter((page) => included[page.room.id]).length);
	let glanceableCount = $derived(
		proposal?.glanceables.filter((widget) => widget.type !== 'label').length ?? 0
	);
	let canApply = $derived(includedCount > 0 || (includeGlanceables && glanceableCount > 0));

	async function load() {
		if (!$connection) {
			status = 'disconnected';
			return;
		}
		status = 'loading';
		try {
			const snapshot = await fetchRegistry();
			proposal = buildProposal(snapshot, $states ?? {});
			// an untouched dashboard has nothing worth keeping; one the user has
			// already built on defaults to leaving those pages alone
			mode = replacedCount > 0 ? 'add' : 'replace';
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
			proposal.pages.map((page) => [page.room.id, value && !(mode === 'add' && isExisting(page))])
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
		return SUMMARY_KEYS.filter(([key]) => page.counts[key] > 0)
			.map(([key, one, many]) => count(page.counts[key], one, many))
			.join(', ');
	}

	function runImport() {
		if (!proposal) return;
		// unwrap the $state proxies - the config store gets structuredCloned on
		// every later mutation and proxies cannot be structured-cloned
		const plain = $state.snapshot(proposal) as HearthProposal;
		const chosen = plain.pages.filter((page) => included[page.room.id]);
		updateConfig((config) =>
			applyImport(config, {
				pages: chosen,
				glanceables: includeGlanceables ? plain.glanceables : [],
				mode
			})
		);
		hearthNeedsSetup.set(false);
		// outside edit mode nothing else would persist the import, and a reload
		// would silently drop it
		if (!get(hearthEditMode)) void persist();
		onclose();
	}

	async function persist() {
		await saveWithFeedback();
		// only the edit bar reports a failed or conflicting save, and it is the
		// only way to retry one - so hand the still-unsaved import over to it
		if (get(saveState) !== 'saved') enterEditMode();
	}

	function apply() {
		if (mode === 'replace' && replacedCount > 0) {
			requestConfirmation({
				title: $lang('hearth_import'),
				message: fill($lang('hearth_import_replace_confirm'), { count: String(replacedCount) }),
				confirmLabel: $lang('hearth_apply'),
				action: runImport
			});
			return;
		}
		runImport();
	}
</script>

<div
	class="overlay"
	role="presentation"
	onpointerdown={(event) => event.target === event.currentTarget && onclose()}
	use:layer={onclose}
>
	<div class="panel" role="dialog" aria-modal="true" aria-label={$lang('hearth_import')}>
		<div class="header">
			<span class="title">{$lang('hearth_import')}</span>
			<button
				type="button"
				class="icon-button"
				aria-label={$lang('hearth_close')}
				onclick={onclose}
			>
				<Icon name="close" size={ICON.control} />
			</button>
		</div>
		<p class="intro">
			{$lang('hearth_import_intro')}
		</p>
		{#if status === 'disconnected'}
			<div class="hint">{$lang('hearth_not_connected')}</div>
		{:else if status === 'loading'}
			<div class="hint">{$lang('hearth_loading_registries')}</div>
		{:else if status === 'error'}
			<div class="hint">
				<span class="error">{errorMessage}</span>
				<button type="button" class="bar-button pressable" use:Ripple={PRESS_RIPPLE} onclick={load}
					>{$lang('hearth_retry')}</button
				>
			</div>
		{:else if proposal}
			{#if replacedCount > 0}
				<div class="modes" role="radiogroup" aria-label={$lang('hearth_import_mode')}>
					{#each [['add', 'hearth_import_mode_add'], ['replace', 'hearth_import_mode_replace']] as [value, label] (value)}
						<button
							type="button"
							role="radio"
							class="mode pressable"
							aria-checked={mode === value}
							class:selected={mode === value}
							use:Ripple={PRESS_RIPPLE}
							onclick={() => {
								mode = value as ImportMode;
								selectAll(true);
							}}
						>
							{$lang(label)}
						</button>
					{/each}
				</div>
				<p class="mode-note">
					{mode === 'replace'
						? fill($lang('hearth_import_replaces_pages'), { count: String(replacedCount) })
						: $lang('hearth_import_keeps_pages')}
				</p>
			{/if}
			{#if proposal.glanceables.length}
				<label class="row glanceables">
					<input type="checkbox" bind:checked={includeGlanceables} />
					<span class="row-icon"><Icon name="today" size={ICON.control} /></span>
					<span class="row-text">
						<span class="row-name">{$lang('hearth_today_glanceables')}</span>
						<span class="row-summary"
							>{count(glanceableCount, 'hearth_one_suggestion', 'hearth_n_suggestions')}</span
						>
					</span>
				</label>
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
					<label class="row">
						<input type="checkbox" bind:checked={included[page.room.id]} />
						<span class="row-icon"><Icon name={page.room.icon} size={ICON.control} /></span>
						<span class="row-text">
							<span class="row-name">{page.room.name}</span>
							<span class="row-summary">{summarize(page)}</span>
						</span>
					</label>
				{:else}
					<div class="hint">
						{mode === 'add' && proposal.pages.length
							? $lang('hearth_no_new_areas')
							: $lang('hearth_no_areas')}
					</div>
				{/each}
			</div>
		{/if}
		<div class="footer">
			<button type="button" class="bar-button pressable" use:Ripple={PRESS_RIPPLE} onclick={onclose}
				>{$lang('cancel')}</button
			>
			{#if status === 'ready'}
				<button
					type="button"
					class="bar-button primary pressable"
					disabled={!canApply}
					use:Ripple={PRESS_RIPPLE}
					onclick={apply}
				>
					{$lang('hearth_apply')}
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.modes {
		display: flex;
		gap: 6px;
		padding: 4px;
		border-radius: var(--h-radius-s);
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

	.link:hover {
		color: var(--h-text-3);
	}

	.floor {
		padding: 10px 10px 4px;
		font-size: var(--h-type-small);
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--h-text-6);
	}
	.overlay {
		position: fixed;
		inset: 0;
		z-index: var(--h-layer-confirm);
		background: var(--h-overlay);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.panel {
		width: 480px;
		max-width: calc(100vw - 40px);
		max-height: calc(100vh - 80px);
		display: flex;
		flex-direction: column;
		background: linear-gradient(180deg, var(--h-sheet-0), var(--h-sheet-1));
		border: 1px solid rgb(var(--h-accent-rgb) / calc(0.18 * var(--h-accent-scale)));
		border-radius: var(--h-radius-xl);
		padding: 20px 22px;
		box-shadow: 0 40px 100px var(--h-scrim);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.title {
		font-size: var(--h-type-subtitle);
		font-weight: 600;
		color: var(--h-text-1);
	}

	.icon-button {
		display: flex;
		color: var(--h-icon);
		cursor: pointer;
		border: 0;
		background: none;
		padding: 0;
	}

	.icon-button:hover {
		color: var(--h-text-3);
	}

	.intro {
		margin: 10px 0 14px;
		font-size: var(--h-type-secondary);
		line-height: 1.5;
		color: var(--h-text-4);
	}

	.list {
		flex: 1;
		min-height: 80px;
		overflow-y: auto;
		margin: 0 -6px;
		padding: 0 6px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 10px;
		border-radius: var(--h-radius-xs);
		cursor: pointer;
	}

	.row:hover {
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
	}

	.row input {
		accent-color: var(--h-accent-deep);
		width: 16px;
		height: 16px;
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
		color: var(--h-bad-text);
	}

	.footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 14px;
	}

	.bar-button {
		padding: 10px 20px;
		border-radius: var(--h-radius-xs);
		font-size: var(--h-type-body);
		font-weight: 600;
		cursor: pointer;
		color: var(--h-text-3);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		user-select: none;
		-webkit-user-select: none;
		font-family: inherit;
	}

	.bar-button.primary {
		background: linear-gradient(135deg, var(--h-accent-deep), var(--h-accent-bright));
		border: none;
		color: var(--h-on-accent);
	}

	.bar-button:disabled {
		opacity: 0.5;
		pointer-events: none;
	}
</style>
