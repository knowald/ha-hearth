<script module lang="ts">
	import type { HearthConfig } from '../../config';

	/** The dashboard keys this section's rows change, including the page sheets it opens. */
	export const SETTING_KEYS = ['rooms'] as const satisfies readonly (keyof HearthConfig)[];
</script>

<script lang="ts">
	import { ICON } from '../../iconSizes';
	import { fill, lang } from '$lib/core/i18n';
	import { moveItem } from '../../config';
	import { hearthConfig, setupWizardOpen, setupWizardSource, updateConfig } from '../../store';
	import Icon from '../../Icon.svelte';
	import SettingsRow from '../SettingsRow.svelte';
	import Searchable from './Searchable.svelte';
	import { editorOpener } from './opener';
	import SettingsSection from './SettingsSection.svelte';

	const openEditor = editorOpener();

	function movePage(index: number, delta: number) {
		updateConfig((config) => moveItem(config.rooms, index, delta));
	}
</script>

<SettingsSection id="pages" title={$lang('hearth_pages')} scope="dashboard">
	<!-- every page in rail order, reachable whatever the rail shows -->
	{#each $hearthConfig.rooms as room, index (room.id)}
		<Searchable text={[room.name || room.id]}>
			<div class="page-row">
				<button
					type="button"
					class="page-open"
					onclick={() => openEditor({ kind: 'room', id: room.id })}
				>
					<Icon name={room.icon} size={ICON.control} />
					<span class="page-name">{room.name || room.id}</span>
				</button>
				<button
					type="button"
					class="step"
					aria-label={fill($lang('hearth_move_named_up'), { name: room.name || room.id })}
					disabled={index === 0}
					onclick={() => movePage(index, -1)}
				>
					<Icon name="arrow_upward" size={ICON.control} />
				</button>
				<button
					type="button"
					class="step"
					aria-label={fill($lang('hearth_move_named_down'), { name: room.name || room.id })}
					disabled={index === $hearthConfig.rooms.length - 1}
					onclick={() => movePage(index, 1)}
				>
					<Icon name="arrow_downward" size={ICON.control} />
				</button>
			</div>
		</Searchable>
	{/each}
	<SettingsRow
		icon="add"
		label={$lang('hearth_add_page')}
		onclick={() => openEditor({ kind: 'room', id: null })}
	/>
	<SettingsRow
		icon="auto_awesome"
		label={$lang('hearth_setup')}
		sub={$lang('hearth_setup_row_sub')}
		onclick={() => {
			setupWizardSource.set('areas');
			setupWizardOpen.set(true);
		}}
	/>
	<SettingsRow
		icon="dashboard_customize"
		label={$lang('hearth_starter_layouts')}
		sub={$lang('hearth_starter_layouts_sub')}
		onclick={() => {
			setupWizardSource.set('starter');
			setupWizardOpen.set(true);
		}}
	/>
</SettingsSection>

<style>
	.step {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		background: none;
		color: var(--h-icon);
		cursor: pointer;
	}

	@media (hover: hover) {
		.step:hover {
			color: var(--h-accent-text);
		}
	}

	.step:disabled {
		color: var(--h-icon-dim);
		cursor: default;
	}

	.page-row {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 10px 6px 0;
		min-height: 56px;
		border-bottom: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
	}

	.page-open {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 14px;
		align-self: stretch;
		padding: 0 16px;
		border: 0;
		background: none;
		color: var(--h-icon);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.page-name {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: var(--h-type-body);
		color: var(--h-text-2);
	}

	@media (hover: hover) {
		.page-open:hover .page-name {
			color: var(--h-accent-text);
		}
	}
</style>
