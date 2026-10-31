<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import Ripple from '$lib/ui/actions/ripple';
	import { fill, lang } from '$lib/core/i18n';
	import { motion } from '$lib/core/app/motion';
	import { screenOverrides } from '$lib/core/app/screen';
	import { PRESS_RIPPLE } from '../config';
	import { ICON } from '../iconSizes';
	import Icon from '../Icon.svelte';
	import { screenSheetOpen } from '../screen';
	import {
		editBaseline,
		editor,
		hearthConfig,
		type Editor,
		type SettingsSectionId
	} from '../store';
	import { confirmDiscard } from './discard';
	import EditSheet from './EditSheet.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import AlertsSection, { SETTING_KEYS as ALERTS_KEYS } from './settings/AlertsSection.svelte';
	import AppearanceSection, {
		SETTING_KEYS as APPEARANCE_KEYS
	} from './settings/AppearanceSection.svelte';
	import { countChanged } from './settings/changes';
	import LayoutSection, { SETTING_KEYS as LAYOUT_KEYS } from './settings/LayoutSection.svelte';
	import { provideSettingsGuard } from './settings/guard';
	import PagesSection, { SETTING_KEYS as PAGES_KEYS } from './settings/PagesSection.svelte';
	import ScreenSection, { SETTING_KEYS as SCREEN_KEYS } from './settings/ScreenSection.svelte';
	import { provideSettingsSearch, SettingsSearch } from './settings/search.svelte';
	import ServerSection from './settings/ServerSection.svelte';
	import SettingsSection from './settings/SettingsSection.svelte';
	import SizeSection, { SETTING_KEYS as SIZE_KEYS } from './settings/SizeSection.svelte';
	import WallDisplaySection, {
		SETTING_KEYS as WALL_KEYS
	} from './settings/WallDisplaySection.svelte';

	/*
	 * Every setting in one sheet: a section list beside (or, folded, above) the
	 * sections, a search across their rows, and a footer that says what will
	 * happen to the changes. Outside edit mode only This screen is reachable,
	 * so `screenOnly` drops everything else.
	 */
	let { screenOnly = false, section }: { screenOnly?: boolean; section?: SettingsSectionId } =
		$props();

	type Group = 'device' | 'dashboard' | 'server';

	const SECTIONS: { id: SettingsSectionId; group: Group; icon: string; title: string }[] = [
		{ id: 'screen', group: 'device', icon: 'display_settings', title: 'hearth_this_screen' },
		{ id: 'appearance', group: 'dashboard', icon: 'palette', title: 'hearth_appearance' },
		{
			id: 'layout',
			group: 'dashboard',
			icon: 'view_sidebar',
			title: 'hearth_layout_and_navigation'
		},
		{ id: 'size', group: 'dashboard', icon: 'straighten', title: 'hearth_size_and_spacing' },
		{ id: 'wall', group: 'dashboard', icon: 'nest_display', title: 'hearth_wall_display' },
		{ id: 'alerts', group: 'dashboard', icon: 'notifications', title: 'hearth_alerts' },
		{ id: 'pages', group: 'dashboard', icon: 'tab', title: 'hearth_pages' },
		{ id: 'maintenance', group: 'dashboard', icon: 'build', title: 'hearth_maintenance' },
		{ id: 'server', group: 'server', icon: 'dns', title: 'hearth_server_settings' }
	];

	const GROUP_TITLES: Record<Group, string> = {
		device: 'hearth_this_device',
		dashboard: 'hearth_dashboard',
		server: 'hearth_server'
	};

	const DASHBOARD_KEYS = {
		appearance: APPEARANCE_KEYS,
		layout: LAYOUT_KEYS,
		size: SIZE_KEYS,
		wall: WALL_KEYS,
		alerts: ALERTS_KEYS,
		pages: PAGES_KEYS
	} as const;

	const search = new SettingsSearch();
	provideSettingsSearch(search);

	// Dashboard changes count from what Save in the edit bar keeps them against,
	// so a trip to another editor and back keeps them; outside edit mode, and
	// for this screen's own choices, from what the sheet opened with.
	const openedConfig = get(hearthConfig);
	const openedOverrides = get(screenOverrides);

	let server = $state<ServerSection>();
	let serverChanges = $state(0);
	let serverSaving = $state(false);
	let serverSaved = $state(false);

	let counts = $derived.by(() => {
		const baseline = editBaseline() ?? openedConfig;
		const result: Record<SettingsSectionId, number> = {
			screen: countChanged(SCREEN_KEYS, openedOverrides, $screenOverrides),
			appearance: 0,
			layout: 0,
			size: 0,
			wall: 0,
			alerts: 0,
			pages: 0,
			maintenance: 0,
			server: serverChanges
		};
		for (const [id, keys] of Object.entries(DASHBOARD_KEYS)) {
			result[id as keyof typeof DASHBOARD_KEYS] = countChanged(keys, baseline, $hearthConfig);
		}
		return result;
	});

	let dashboardChanges = $derived(
		Object.keys(DASHBOARD_KEYS).reduce(
			(sum, id) => sum + counts[id as keyof typeof DASHBOARD_KEYS],
			0
		)
	);

	// a saved note stands until the next staged change
	$effect(() => {
		if (serverChanges > 0) serverSaved = false;
	});

	function close() {
		if (screenOnly) screenSheetOpen.set(false);
		else editor.set(null);
	}

	// leaving for another editor unmounts the sheet and its staged server values
	function openEditor(next: Editor) {
		confirmDiscard(serverChanges > 0, () => editor.set(next));
	}
	provideSettingsGuard({
		leave: (leave) => confirmDiscard(serverChanges > 0, leave),
		serverChanged: () => serverChanges > 0
	});

	async function saveServer() {
		// the error and its actions sit in the section, which may be out of view
		if (server && !(await server.save())) void jump('server');
	}

	// the sheet remounts for another section, so the first value is the only one
	// svelte-ignore state_referenced_locally
	let active = $state<SettingsSectionId>(section ?? 'screen');
	let content = $state<HTMLElement>();
	let nav = $state<HTMLElement>();
	// a jump's own smooth scroll passes other sections; the spy waits it out
	let jumpUntil = 0;

	async function jump(id: SettingsSectionId, smooth = true) {
		search.query = '';
		active = id;
		jumpUntil = performance.now() + 800;
		await tick();
		const target = content?.querySelector<HTMLElement>(`[data-section="${id}"]`);
		if (!content || !target) return;
		content.scrollTo?.({
			top: target.offsetTop - 12,
			behavior: smooth && $motion ? 'smooth' : 'auto'
		});
	}

	/** Marks the section at the top of the list, or the last one once the list ends. */
	function spy() {
		if (!content || search.active || performance.now() < jumpUntil) return;
		const sections = [...content.querySelectorAll<HTMLElement>('[data-section]')];
		const top = content.scrollTop + 40;
		let current = sections[0]?.dataset.section;
		for (const element of sections) {
			if (element.offsetTop <= top) current = element.dataset.section;
		}
		if (content.scrollTop + content.clientHeight >= content.scrollHeight - 4) {
			current = sections.at(-1)?.dataset.section;
		}
		if (current) active = current as SettingsSectionId;
	}

	// a cleared search can bring the list back without a scroll event
	let searched = false;
	$effect(() => {
		const searching = search.active;
		const cleared = searched && !searching;
		searched = searching;
		if (!cleared) return;
		const frame = requestAnimationFrame(spy);
		return () => cancelAnimationFrame(frame);
	});

	// folded, the section list is a row of chips; keep the active one in view
	$effect(() => {
		if (!nav || nav.scrollWidth <= nav.clientWidth) return;
		const chip = nav.querySelector<HTMLElement>(`[data-target="${active}"]`);
		if (chip) nav.scrollTo?.({ left: chip.offsetLeft - 16, behavior: $motion ? 'smooth' : 'auto' });
	});

	onMount(() => {
		if (section && !screenOnly) void jump(section, false);
	});
</script>

{#snippet searchField()}
	<label class="search field-frame">
		<Icon name="search" size={ICON.control} />
		<input
			type="search"
			bind:value={search.query}
			onkeydown={(event) => {
				// the layer leaves Escape to a search field with text (see layers.ts)
				if (event.key === 'Escape' && search.query && !event.isComposing) {
					event.preventDefault();
					search.query = '';
				}
			}}
			placeholder={$lang('hearth_search_settings')}
			aria-label={$lang('hearth_search_settings')}
			autocomplete="off"
			spellcheck="false"
		/>
	</label>
{/snippet}

<!-- every dashboard and screen row applies as it changes, so the close button is
     the only header action; server values wait for the footer's Save -->
<EditSheet
	title={$lang(screenOnly ? 'hearth_this_screen' : 'settings')}
	wide={!screenOnly}
	split={!screenOnly}
	dirty={serverChanges > 0}
	onclose={close}
	tools={screenOnly ? undefined : searchField}
>
	{#if screenOnly}
		<div class="settings">
			<ScreenSection />
		</div>
	{:else}
		<div class="settings-layout">
			<nav class="section-nav" aria-label={$lang('hearth_settings_sections')} bind:this={nav}>
				{#each SECTIONS as item, index (item.id)}
					{#if index === 0 || SECTIONS[index - 1].group !== item.group}
						<div class="nav-group">{$lang(GROUP_TITLES[item.group])}</div>
					{/if}
					<button
						type="button"
						class="nav-item"
						data-target={item.id}
						aria-current={active === item.id ? 'true' : undefined}
						onclick={() => jump(item.id)}
					>
						<Icon name={item.icon} size={ICON.control} />
						<span class="nav-title">{$lang(item.title)}</span>
						{#if counts[item.id]}
							<span class="nav-count">
								<span aria-hidden="true">{counts[item.id]}</span>
								<span class="hidden-label">
									{fill($lang('hearth_settings_changed_count'), { count: counts[item.id] })}
								</span>
							</span>
						{/if}
					</button>
				{/each}
			</nav>
			<div class="settings-content" bind:this={content} onscroll={spy}>
				<div class="settings-list">
					<ScreenSection />
					<AppearanceSection />
					<LayoutSection />
					<SizeSection />
					<WallDisplaySection />
					<AlertsSection />
					<PagesSection />
					<SettingsSection id="maintenance" title={$lang('hearth_maintenance')} scope="dashboard">
						<SettingsRow
							icon="code"
							label={$lang('hearth_edit_configuration_yaml')}
							sub={$lang('hearth_edits_the_whole_configuration_as_yaml')}
							onclick={() =>
								openEditor({ kind: 'code', from: { kind: 'settings', section: 'maintenance' } })}
						/>
						<SettingsRow
							icon="history"
							label={$lang('hearth_versions')}
							sub={$lang('hearth_versions_row_sub')}
							onclick={() =>
								openEditor({
									kind: 'versions',
									from: { kind: 'settings', section: 'maintenance' }
								})}
						/>
					</SettingsSection>
					<ServerSection
						bind:this={server}
						bind:changes={serverChanges}
						bind:saving={serverSaving}
						onsaved={() => (serverSaved = true)}
					/>
					<p class="no-match" role="status">
						{#if search.active && search.matched === 0}{$lang('hearth_no_matches')}{/if}
					</p>
				</div>
			</div>
			<footer class="settings-footer">
				<div class="footer-status">
					{#if dashboardChanges}
						<span class="dashboard-status">
							<Icon name="dashboard" size={ICON.inline} />
							{fill(
								$lang(
									dashboardChanges === 1
										? 'hearth_dashboard_changes_one'
										: 'hearth_dashboard_changes'
								),
								{ count: dashboardChanges }
							)}
						</span>
					{/if}
					{#if serverChanges}
						<span class="server-status">
							<Icon name="dns" size={ICON.inline} />
							{fill(
								$lang(
									serverChanges === 1
										? 'hearth_unsaved_server_settings_one'
										: 'hearth_unsaved_server_settings'
								),
								{ count: serverChanges }
							)}
						</span>
					{/if}
					<span class="server-status" role="status">
						{#if serverSaved}
							<Icon name="check" size={ICON.inline} />
							{$lang('hearth_server_settings_saved')}
						{/if}
					</span>
					{#if !dashboardChanges && !serverChanges && !serverSaved}
						<span>{$lang('hearth_settings_status_idle')}</span>
					{/if}
				</div>
				{#if serverChanges}
					<div class="footer-actions">
						<button
							type="button"
							class="hearth-button secondary pressable"
							disabled={serverSaving}
							use:Ripple={PRESS_RIPPLE}
							onclick={() => server?.discard()}
						>
							{$lang('hearth_discard')}
						</button>
						<button
							type="button"
							class="hearth-button primary pressable"
							disabled={serverSaving}
							use:Ripple={PRESS_RIPPLE}
							onclick={saveServer}
						>
							{$lang('hearth_save_server_settings')}
						</button>
					</div>
				{/if}
			</footer>
		</div>
	{/if}
</EditSheet>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 18px;
		width: 100%;
	}

	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 14px 0 10px;
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		border-radius: var(--h-radius-pill);
		background: rgb(var(--h-surface-rgb) / calc(0.05 * var(--h-fill-scale)));
		color: var(--h-icon);
	}

	.search input {
		flex: 1;
		min-width: 0;
		padding: 8px 0;
		border: 0;
		background: none;
		color: var(--h-text-2);
		font: inherit;
		font-size: var(--h-type-body);
		outline: none;
	}

	.search input::placeholder {
		color: var(--h-text-4);
	}

	.settings-layout {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 236px minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr) auto;
	}

	.section-nav {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 14px 10px;
		overflow-y: auto;
		border-right: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
	}

	.nav-group {
		padding: 14px 12px 6px;
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-label);
	}

	.nav-group:first-child {
		padding-top: 4px;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border: 0;
		border-radius: var(--h-radius-xs);
		background: none;
		color: var(--h-text-3);
		font: inherit;
		font-size: var(--h-type-body);
		text-align: left;
		cursor: pointer;
		transition: background var(--h-motion-fast) var(--h-ease);
	}

	.nav-item :global(.mi) {
		color: var(--h-icon);
	}

	@media (hover: hover) {
		.nav-item:hover {
			background: rgb(var(--h-surface-rgb) / calc(0.04 * var(--h-fill-scale)));
		}
	}

	.nav-item[aria-current='true'] {
		background: rgb(var(--h-surface-rgb) / calc(0.08 * var(--h-fill-scale)));
		color: var(--h-text-1);
	}

	.nav-item[aria-current='true'] :global(.mi) {
		color: var(--h-accent-text);
	}

	.nav-title {
		flex: 1;
		min-width: 0;
	}

	.nav-count {
		padding: 0 8px;
		border-radius: var(--h-radius-pill);
		background: rgb(var(--h-accent-rgb) / calc(0.16 * var(--h-accent-scale)));
		color: var(--h-accent-text);
		font-family: var(--h-font-mono);
		font-size: var(--h-type-small);
	}

	/* read out with the button, drawn as the bare number */
	.hidden-label {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.settings-content {
		position: relative;
		overflow-y: auto;
		scrollbar-gutter: stable;
		padding: 22px 28px 32px;
	}

	.settings-list {
		display: flex;
		flex-direction: column;
		gap: 28px;
		max-width: 920px;
	}

	.no-match {
		margin: 0;
		color: var(--h-text-4);
		font-size: var(--h-type-body);
		text-align: center;
	}

	/* live regions stay in the page while empty, or their first text goes unannounced */
	.no-match:empty,
	.footer-status > span:empty {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.settings-footer {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 16px;
		padding: 12px 28px;
		border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
		font-size: var(--h-type-small);
		color: var(--h-text-4);
	}

	/* wraps above the buttons once both no longer fit on one line */
	.footer-status {
		flex: 1 1 240px;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px 16px;
	}

	.footer-status > span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.dashboard-status {
		color: var(--h-accent-text);
	}

	.server-status {
		color: var(--h-good-text);
	}

	.footer-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
		min-width: 0;
		margin-left: auto;
	}

	/* see breakpoints.ts */
	@media (max-width: 900px) {
		.settings-layout {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr) auto;
		}

		.section-nav {
			flex-direction: row;
			gap: 6px;
			padding: 8px 10px;
			overflow-x: auto;
			overflow-y: hidden;
			border-right: 0;
			border-bottom: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
			scrollbar-width: none;
		}

		.nav-group,
		.nav-item :global(.mi) {
			display: none;
		}

		.nav-item {
			flex: none;
			gap: 8px;
			padding: 8px 12px;
			border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
			border-radius: var(--h-radius-pill);
			white-space: nowrap;
		}

		.settings-content {
			padding: 18px;
		}

		.settings-footer {
			padding: 10px 18px 14px;
		}

		/* a long label in a narrow sheet wraps inside its button instead of running off */
		.footer-actions {
			flex: 1 1 100%;
		}

		.footer-actions button {
			flex: 1 1 auto;
			min-width: 0;
			white-space: normal;
		}
	}
</style>
