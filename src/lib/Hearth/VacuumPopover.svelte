<script lang="ts">
	import { ICON } from './iconSizes';
	import { lang, fill } from '$lib/core/i18n';
	import { onDestroy } from 'svelte';
	import Ripple from '$lib/ui/actions/ripple';
	import { states } from '$lib/core/ha/entities';
	import { PRESS_RIPPLE, type VacuumModeRef } from './config';
	import { getHearthInteractionMode } from './interaction';
	import { callEntityService } from '$lib/core/ha/commands';
	import { vacuumActions, vacuumCommand, type VacuumAction } from '$lib/core/domains/vacuum';
	import EmptyState from './EmptyState.svelte';
	import Icon from './Icon.svelte';

	let {
		entity,
		modes,
		batteryEntity,
		binEntity
	}: {
		entity: string;
		modes: VacuumModeRef[];
		batteryEntity?: string;
		binEntity?: string;
	} = $props();

	const readonly = getHearthInteractionMode() !== 'runtime';

	// how long the undo strip stays up. Every mode runs on a single tap, so this
	// window is what replaces a confirm step - short enough that the robot is
	// still at the dock when it expires
	const UNDO_MS = 6000;

	const statusKeys: Record<string, string> = {
		docked: 'docked',
		cleaning: 'cleaning',
		returning: 'returning',
		paused: 'paused',
		idle: 'idle',
		error: 'hearth_vacuum_needs_help'
	};

	function percent(value: unknown): number | null {
		const number = typeof value === 'number' ? value : parseFloat(String(value));
		return Number.isFinite(number) ? Math.round(number) : null;
	}

	function modeName(mode: VacuumModeRef) {
		return mode.name || $states?.[mode.entity]?.attributes?.friendly_name || mode.entity;
	}

	function modeMeta(mode: VacuumModeRef) {
		return [mode.detail, mode.duration].filter(Boolean).join(' · ');
	}

	let vacuum = $derived($states?.[entity]);
	let status = $derived($lang(statusKeys[vacuum?.state ?? ''] ?? 'unavailable'));
	let battery = $derived(
		batteryEntity
			? percent($states?.[batteryEntity]?.state)
			: percent(vacuum?.attributes?.battery_level)
	);
	let bin = $derived(binEntity ? percent($states?.[binEntity]?.state) : null);
	let statusLine = $derived(
		[status, battery === null ? null : `${battery}%`, bin === null ? null : `bin ${bin}%`]
			.filter(Boolean)
			.join(' · ')
	);
	// the meta line is rendered on every tile once any mode carries one, so the
	// tiles stay identical in height - the whole point of this layout
	let showMeta = $derived(modes.some((mode) => mode.detail || mode.duration));

	// the same commands as the detail sheet, less a plain start: starting a
	// run is the mode grid's job
	let actions = $derived(
		vacuumActions(vacuum?.state, vacuum?.attributes?.supported_features ?? 0).filter(
			(action) => action.label !== 'hearth_start'
		)
	);

	let launched = $state<{ index: number; mode: VacuumModeRef } | null>(null);
	let undoTimer: ReturnType<typeof setTimeout> | undefined;

	function launch(mode: VacuumModeRef, index: number) {
		if (readonly) return;
		callEntityService('button', 'press', mode.entity);
		launched = { index, mode };
		clearTimeout(undoTimer);
		undoTimer = setTimeout(() => (launched = null), UNDO_MS);
	}

	function undo() {
		clearTimeout(undoTimer);
		launched = null;
		if (readonly) return;
		vacuumCommand(entity, 'return_to_base');
	}

	function run(action: VacuumAction) {
		if (readonly) return;
		vacuumCommand(entity, action.command);
	}

	onDestroy(() => clearTimeout(undoTimer));
</script>

<div class="header">
	<div class="title">{vacuum?.attributes?.friendly_name ?? 'Vacuum'}</div>
	<div class="status">{statusLine}</div>
</div>

{#if modes.length}
	<div class="modes">
		{#each modes as mode, index (`${mode.entity}-${index}`)}
			<button
				type="button"
				class="mode pressable"
				class:started={launched?.index === index}
				use:Ripple={PRESS_RIPPLE}
				onclick={() => launch(mode, index)}
			>
				<div class="glyphs">
					<Icon
						name={mode.icon ?? 'cleaning_services'}
						size={ICON.control}
						color="var(--h-accent-dim-text)"
					/>
					{#if mode.default}<span class="tag">{$lang('hearth_default')}</span>{/if}
				</div>
				<div class="name">{modeName(mode)}</div>
				{#if showMeta}
					<div class="meta">
						<span class="detail">{mode.detail ?? ''}</span>
						{#if mode.duration}<span class="duration">{mode.duration}</span>{/if}
					</div>
				{/if}
			</button>
		{/each}
	</div>
{:else}
	<div class="empty">
		<EmptyState text={$lang('hearth_add_cleaning_mode_button_entities_in')} />
	</div>
{/if}

{#if launched}
	<div class="undo">
		<Icon name="check_circle" size={ICON.control} color="var(--h-good)" />
		<div class="undo-text">
			<div class="undo-title">
				{fill($lang('hearth_starting'), { mode: modeName(launched.mode) })}
			</div>
			{#if modeMeta(launched.mode)}
				<div class="undo-detail">{modeMeta(launched.mode)}</div>
			{/if}
		</div>
		<button type="button" class="undo-action pressable" use:Ripple={PRESS_RIPPLE} onclick={undo}>
			{$lang('undo')}
		</button>
	</div>
{/if}

{#if actions.length}
	<div class="controls">
		{#each actions as action (action.command)}
			<button
				type="button"
				class="control pressable"
				class:primary={action.primary}
				use:Ripple={PRESS_RIPPLE}
				onclick={() => run(action)}
			>
				<Icon name={action.icon} size={ICON.control} fill={action.primary} />
				{$lang(action.label)}
			</button>
		{/each}
	</div>
{/if}

<style>
	.header {
		padding: 2px 2px 0;
	}

	.title {
		color: var(--h-text-1);
		font-size: var(--h-type-title);
		font-weight: 600;
		letter-spacing: -0.2px;
	}

	.status {
		margin-top: 6px;
		color: var(--h-text-4);
		font-size: var(--h-type-secondary);
	}

	.modes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		margin-top: 16px;
	}

	button {
		position: relative;
		overflow: hidden;
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.085 * var(--h-line-scale)));
		border-radius: var(--h-radius-sm);
		background: rgb(var(--h-surface-rgb) / calc(0.045 * var(--h-fill-scale)));
		color: var(--h-text-3);
		font: inherit;
		cursor: pointer;
	}

	.mode {
		min-width: 0;
		padding: 14px;
		text-align: left;
	}

	.mode.started {
		border-color: rgb(var(--h-accent-rgb) / calc(0.5 * var(--h-accent-scale)));
		background: rgb(var(--h-accent-rgb) / calc(0.2 * var(--h-accent-scale)));
	}

	.glyphs {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
	}

	.tag {
		color: var(--h-text-4);
		font-family: var(--h-font-mono);
		font-size: var(--h-type-caption);
		letter-spacing: 1.2px;
		text-transform: uppercase;
	}

	.name {
		margin-top: 10px;
		overflow: hidden;
		color: var(--h-text-2);
		font-size: var(--h-type-emphasis);
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		margin-top: 4px;
		min-height: 15px;
	}

	.detail {
		overflow: hidden;
		color: var(--h-text-5);
		font-size: var(--h-type-label);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.duration {
		flex: none;
		color: var(--h-text-4);
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
	}

	.empty {
		margin-top: 16px;
	}

	.undo {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 12px;
		padding: 14px 16px;
		border: 1px solid color-mix(in srgb, var(--h-good) 30%, transparent);
		border-radius: var(--h-radius-sm);
		background: color-mix(in srgb, var(--h-good) 12%, transparent);
	}

	.undo-text {
		flex: 1;
		min-width: 0;
	}

	.undo-title {
		color: var(--h-text-2);
		font-size: var(--h-type-body);
		font-weight: 600;
	}

	.undo-detail {
		margin-top: 2px;
		color: var(--h-good-text);
		font-size: var(--h-type-small);
	}

	.undo-action {
		flex: none;
		padding: 8px 14px;
		border: none;
		border-radius: var(--h-radius-pill);
		background: rgb(var(--h-surface-rgb) / calc(0.09 * var(--h-fill-scale)));
		color: var(--h-text-2);
		font-size: var(--h-type-secondary);
		font-weight: 600;
	}

	.controls {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}

	.control {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 14px 12px;
		font-size: var(--h-type-body);
		font-weight: 600;
		white-space: nowrap;
	}

	.control.primary {
		border-color: rgb(var(--h-accent-rgb) / calc(0.35 * var(--h-accent-scale)));
		background: rgb(var(--h-accent-rgb) / calc(0.16 * var(--h-accent-scale)));
		color: var(--h-accent-text);
	}
</style>
