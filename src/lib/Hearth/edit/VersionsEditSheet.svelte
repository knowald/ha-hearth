<script lang="ts">
	import LoadingState from '../LoadingState.svelte';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { lang, fill, selectedLanguage } from '$lib/core/i18n';
	import { relativeTime } from '$lib/core/i18n/time';
	import { ICON } from '../iconSizes';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from '../config';
	import { downloadText } from '$lib/ui/download';
	import { editor, hearthConfig, updateConfig, type Editor } from '../store';
	import {
		configDocument,
		documentIssue,
		parseDocument,
		transferFileName,
		withoutRevision
	} from '../transfer';
	import EditSheet from './EditSheet.svelte';
	import Icon from '../Icon.svelte';

	interface Version {
		name: string;
		at: number;
		revision?: number;
		size: number;
	}

	/**
	 * The sheet the back arrow returns to, when this one was opened from
	 * another, including any unapplied YAML draft it handed over for the trip.
	 */
	let { from }: { from?: Editor } = $props();

	// the document a restore would replace, frozen at open time
	const dashboard = configDocument($hearthConfig);

	let versions = $state<Version[]>([]);
	let savedRevision = $state(0);
	let selected = $state<string | null>(null);
	let content = $state<string | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const contents: Record<string, string> = {};

	onMount(load);

	async function load() {
		loading = true;
		error = null;
		try {
			const response = await fetch(`${base}/_api/hearth_versions`);
			if (!response.ok) throw new Error(`${response.status}`);
			const body = await response.json();
			versions = body.versions ?? [];
			savedRevision = body.revision ?? 0;
			await select('current');
		} catch (failure) {
			console.error(failure);
			error = $lang('hearth_could_not_load_file');
		} finally {
			loading = false;
		}
	}

	async function select(name: string) {
		selected = name;
		// a failure belongs to the version it happened on, not to the next one
		error = null;
		content = contents[name] ?? null;
		if (content !== null) return;
		try {
			const address = new URL(`${base}/_api/hearth_versions`, location.origin);
			address.searchParams.set('name', name);
			const response = await fetch(address);
			if (!response.ok) throw new Error(`${response.status}`);
			const body = await response.json();
			contents[name] = body.content;
			// a slower request for a version the user has already moved off must
			// not replace what is on screen
			if (selected === name) content = body.content;
		} catch (failure) {
			console.error(failure);
			if (selected === name) error = $lang('hearth_could_not_load_file');
		}
	}

	// the counter is the server's bookkeeping, not part of the dashboard
	let comparable = $derived(content === null ? null : withoutRevision(content));
	let issue = $derived(content === null ? null : documentIssue(content));
	let unchanged = $derived(comparable !== null && comparable === dashboard);

	function restore() {
		if (content === null || issue) return;
		const normalized = parseDocument(content);
		if (!normalized) return;
		// restoring is an ordinary edit: it lands in the draft with undo behind
		// it, and nothing is written until the edit bar saves
		updateConfig((config) => {
			const target = config as unknown as Record<string, unknown>;
			for (const key of Object.keys(target)) delete target[key];
			Object.assign(target, normalized);
		});
		editor.set(null);
	}

	function download() {
		if (content === null || selected === null) return;
		const version = versions.find((entry) => entry.name === selected);
		downloadText(transferFileName(new Date(version?.at ?? Date.now())), content);
	}

	function sizeLabel(bytes: number) {
		return `${(bytes / 1024).toFixed(1)} kB`;
	}

	function whenLabel(at: number) {
		return relativeTime(new Date(at).toISOString(), $selectedLanguage);
	}
</script>

<EditSheet
	title={$lang('hearth_versions')}
	onclose={() => editor.set(null)}
	onback={from ? () => editor.set(from) : undefined}
	ondone={() => editor.set(null)}
	doneLabel={$lang('hearth_close')}
	wide
>
	<div class="field-hint">{$lang('hearth_versions_hint')}</div>
	{#if error}
		<div class="error" role="alert">{error}</div>
	{/if}
	<div class="versions-layout">
		<div class="list" role="listbox" aria-label={$lang('hearth_versions')} tabindex="-1">
			<button
				type="button"
				class="entry pressable"
				class:on={selected === 'current'}
				role="option"
				aria-selected={selected === 'current'}
				use:Ripple={PRESS_RIPPLE}
				onclick={() => select('current')}
			>
				<Icon name="draft" size={ICON.control} />
				<span class="entry-main">
					<span class="entry-label">{$lang('hearth_saved_file')}</span>
					<span class="entry-sub"
						>{fill($lang('hearth_revision'), { revision: savedRevision })}</span
					>
				</span>
			</button>
			{#each versions as version (version.name)}
				<button
					type="button"
					class="entry pressable"
					class:on={selected === version.name}
					role="option"
					aria-selected={selected === version.name}
					use:Ripple={PRESS_RIPPLE}
					onclick={() => select(version.name)}
				>
					<Icon name="history" size={ICON.control} />
					<span class="entry-main">
						<span class="entry-label">
							{#if version.revision === undefined}
								{whenLabel(version.at)}
							{:else}
								{fill($lang('hearth_revision'), { revision: version.revision })}
							{/if}
						</span>
						<span class="entry-sub">{whenLabel(version.at)} &middot; {sizeLabel(version.size)}</span
						>
					</span>
				</button>
			{/each}
			{#if !loading && versions.length === 0}
				<div class="empty">{$lang('hearth_no_versions')}</div>
			{/if}
		</div>
		<div class="preview">
			{#if comparable === null}
				<LoadingState inline text={$lang('hearth_loading')} />
			{:else}
				<div class="preview-bar">
					{#if unchanged}
						<span class="state">{$lang('hearth_versions_identical')}</span>
					{:else if issue}
						<span class="state bad">{issue}</span>
					{:else}
						<span class="state">{$lang('hearth_versions_diff')}</span>
					{/if}
					<button type="button" class="tool pressable" use:Ripple={PRESS_RIPPLE} onclick={download}>
						<Icon name="download" size={ICON.inline} />
						{$lang('hearth_export_file')}
					</button>
					<button
						type="button"
						class="tool primary pressable"
						disabled={!!issue || unchanged}
						use:Ripple={PRESS_RIPPLE}
						onclick={restore}
					>
						<Icon name="settings_backup_restore" size={ICON.inline} />
						{$lang('hearth_restore')}
					</button>
				</div>
				{#key selected}
					{#await import('$lib/ui/CodeEditor.svelte') then CodeEditor}
						<CodeEditor.default
							value={comparable}
							original={dashboard}
							readOnly
							type="yaml"
							transitionend={false}
						/>
					{/await}
				{/key}
			{/if}
		</div>
	</div>
</EditSheet>

<style>
	.error {
		font-size: var(--h-type-small);
		color: var(--h-bad-text);
		margin-bottom: 10px;
	}

	.versions-layout {
		display: grid;
		grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
		align-items: start;
		gap: 20px;
	}

	.list {
		border-radius: var(--h-radius-sm);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		background: var(--h-track);
		overflow: hidden;
	}

	.entry {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 14px;
		border: 0;
		background: none;
		color: var(--h-text-3);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.entry + .entry {
		border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
	}

	.entry.on {
		background: rgb(var(--h-accent-rgb) / calc(0.14 * var(--h-accent-scale)));
	}

	.entry-main {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.entry-label {
		font-size: var(--h-type-body);
	}

	.entry-sub {
		font-size: var(--h-type-small);
		color: var(--h-text-6);
	}

	.empty {
		padding: 14px;
		font-size: var(--h-type-small);
		color: var(--h-text-6);
	}

	.preview {
		min-width: 0;
	}

	.preview-bar {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
	}

	/* the actions stay on the line; a long parse error is the part that gives */
	.state {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--h-type-small);
		color: var(--h-text-6);
	}

	.state.bad {
		color: var(--h-bad-text);
	}

	.tool {
		display: inline-flex;
		flex: none;
		align-items: center;
		white-space: nowrap;
		gap: 8px;
		padding: 8px 14px;
		border-radius: var(--h-radius-xs);
		font-family: inherit;
		font-size: var(--h-type-secondary);
		color: var(--h-text-3);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		cursor: pointer;
	}

	.tool.primary {
		background: linear-gradient(135deg, var(--h-accent-deep), var(--h-accent-bright));
		border: none;
		color: var(--h-on-accent);
	}

	.tool:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* see breakpoints.ts */
	@media (max-width: 900px) {
		.versions-layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
