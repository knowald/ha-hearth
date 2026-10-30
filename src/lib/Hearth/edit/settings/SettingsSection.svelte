<script module lang="ts">
	/** Where a section's values are kept, which decides when a change applies and to whom. */
	export type SettingsScope = 'browser' | 'dashboard' | 'server';

	const SCOPES = {
		browser: {
			icon: 'devices',
			label: 'hearth_scope_this_browser',
			note: 'hearth_stored_in_this_browser_only'
		},
		dashboard: { icon: 'dashboard', label: 'hearth_scope_dashboard', note: 'hearth_settings_note' },
		server: { icon: 'dns', label: 'hearth_scope_server', note: 'hearth_server_settings_note' }
	} as const;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { lang } from '$lib/core/i18n';
	import { ICON } from '../../iconSizes';
	import Icon from '../../Icon.svelte';
	import type { SettingsSectionId } from '../../store';
	import { provideSectionMatches, settingsSearch } from './search.svelte';

	/*
	 * One titled section of the settings sheet: the heading with a chip that
	 * says where its values are kept, a line on what that means, and the
	 * bordered run of rows the children fill. The search hides it when none of
	 * its rows match.
	 */
	let {
		id,
		title,
		scope,
		clip = false,
		keep = false,
		children,
		after
	}: {
		id: SettingsSectionId;
		title: string;
		scope: SettingsScope;
		/** Clips instead of hiding overflow, so a sticky child can still pin. */
		clip?: boolean;
		/**
		 * Stays shown during a search without a matching row, for an alert it
		 * holds: hiding and showing it again would announce the alert again.
		 */
		keep?: boolean;
		children: Snippet;
		/** Shown under the rows, such as a save error. */
		after?: Snippet;
	} = $props();

	const search = settingsSearch();
	const matches = provideSectionMatches();
	$effect.pre(() => {
		matches.title = title;
	});
	let kept = $derived(SCOPES[scope]);
</script>

<section
	class="settings-section"
	data-section={id}
	aria-labelledby="settings-section-{id}"
	hidden={search?.active && matches.count === 0 && !keep}
>
	<div class="section-head">
		<h2 class="section-title" id="settings-section-{id}">{title}</h2>
		<span class="section-scope {scope}">
			<Icon name={kept.icon} size={ICON.inline} />
			<span class="scope-label">{$lang(kept.label)}</span>
		</span>
	</div>
	{#if !search?.active}<div class="section-note">{$lang(kept.note)}</div>{/if}
	<div class="rows" class:clip>
		{@render children()}
	</div>
	{@render after?.()}
</section>

<style>
	.settings-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
		/* a jump from the section list stops short of the edge */
		scroll-margin-top: 12px;
	}

	.settings-section[hidden] {
		display: none;
	}

	.section-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 12px;
	}

	.section-title {
		margin: 0;
		font-size: var(--h-type-emphasis);
		font-weight: 600;
		color: var(--h-text-1);
	}

	.section-scope {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 2px 10px 2px 8px;
		border: 1px solid currentColor;
		border-radius: var(--h-radius-pill);
		font-size: var(--h-type-small);
	}

	.section-scope.browser {
		color: var(--h-cool-text);
	}

	.section-scope.dashboard {
		color: var(--h-accent-text);
	}

	.section-scope.server {
		color: var(--h-good-text);
	}

	.section-note {
		font-size: var(--h-type-small);
		color: var(--h-text-6);
	}

	.rows {
		border-radius: var(--h-radius-sm);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		background: var(--h-track);
		overflow: hidden;
	}

	.rows.clip {
		overflow: clip;
	}
</style>
