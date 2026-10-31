<script lang="ts">
	import type { Snippet } from 'svelte';
	import { lang } from '$lib/core/i18n';
	import { autofocus } from '$lib/ui/actions/autofocus';
	import Ripple from '$lib/ui/actions/ripple';
	import { layer } from '$lib/ui/layers';
	import { PRESS_RIPPLE } from '../config';
	import { ICON } from '../iconSizes';
	import Icon from '../Icon.svelte';
	import SnippetInput from './SnippetInput.svelte';
	import '../buttons.css';

	/**
	 * The one type picker for cards and rail widgets. Open, it is a searchable
	 * gallery that fills the sheet while there is nothing else to look at;
	 * picking a kind collapses it to a single row that reopens on tap, so the
	 * fields and preview keep the whole workspace.
	 *
	 * With onconfirm it is a two-step picker instead: a tap only selects and
	 * the preview beside the kinds follows; the action under the preview, a
	 * double tap or Enter goes on with the selected kind.
	 */
	interface Kind {
		type: string;
		name: string;
		sub: string;
		icon: string;
		group?: string;
	}

	let {
		kinds,
		groups = [],
		selected,
		label,
		searchPlaceholder,
		noMatch,
		open = $bindable(false),
		onselect,
		onconfirm,
		confirmLabel = '',
		preview,
		previewHint = '',
		onpaste,
		pasteCheck,
		pasteHint = ''
	}: {
		kinds: readonly Kind[];
		/** Headings for the kinds' groups, in order; the kinds come in one run without them. */
		groups?: readonly { id: string; label: string }[];
		selected: string;
		/** Translation key for the collapsed row's caption, e.g. "Card type". */
		label: string;
		searchPlaceholder: string;
		noMatch: string;
		open?: boolean;
		onselect: (type: string) => void;
		onconfirm?: () => void;
		confirmLabel?: string;
		/** The selected kind as it would look, beside the kinds. */
		preview?: Snippet;
		/** What happens after the confirm action, under the preview. */
		previewHint?: string;
		/** Adds what was pasted as YAML, or returns why it cannot; no Paste YAML without it. */
		onpaste?: (text: string) => string | null;
		/** Why pasted text cannot be added, checked as it arrives; null when it can. */
		pasteCheck?: (text: string) => string | null;
		pasteHint?: string;
	} = $props();

	const uid = $props.id();

	let search = $state('');
	let pasting = $state(false);

	let current = $derived(kinds.find((kind) => kind.type === selected));
	let paned = $derived(onconfirm !== undefined);

	let matches = $derived.by(() => {
		const query = search.trim().toLowerCase();
		if (!query) return kinds;
		return kinds.filter(
			(kind) =>
				$lang(kind.name).toLowerCase().includes(query) ||
				$lang(kind.sub).toLowerCase().includes(query)
		);
	});

	// a kind whose group has no heading still shows, in a run of its own at the end
	let sections = $derived.by(() => {
		if (!groups.length) return [{ id: 'all', label: '', kinds: matches }];
		const known = new Set(groups.map((group) => group.id));
		return [
			...groups.map((group) => ({
				...group,
				kinds: matches.filter((kind) => kind.group === group.id)
			})),
			{ id: 'other', label: '', kinds: matches.filter((kind) => !known.has(kind.group ?? '')) }
		].filter((section) => section.kinds.length);
	});

	function pick(type: string) {
		onselect(type);
		if (paned) return;
		open = false;
		search = '';
	}

	// the sheet reads its preview while the gallery is still open
	function confirm(type: string) {
		if (type !== selected) onselect(type);
		onconfirm?.();
		open = false;
		search = '';
	}

	function keydown(event: KeyboardEvent, type: string) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		if (paned && event.key === 'Enter') confirm(type);
		else pick(type);
	}
</script>

<div class="type-gallery" class:open class:paned={paned && open}>
	{#if open}
		<div class="panel" use:layer={() => (open = false)}>
			<div class="choices">
				{#if pasting && onpaste}
					<SnippetInput
						label={$lang('hearth_yaml_to_add')}
						hint={pasteHint}
						submitLabel={$lang('add')}
						check={pasteCheck}
						onsubmit={onpaste}
						oncancel={() => (pasting = false)}
					/>
				{:else}
					<div class="search-row">
						<label class="search">
							<Icon name="search" size={ICON.inline} />
							<input
								type="text"
								aria-label={searchPlaceholder}
								bind:value={search}
								placeholder={searchPlaceholder}
								spellcheck="false"
								use:autofocus
							/>
							{#if current && !paned}
								<button
									type="button"
									class="collapse"
									aria-label={$lang('hearth_close')}
									onclick={() => (open = false)}
								>
									<Icon name="close" size={ICON.control} />
								</button>
							{/if}
						</label>
						{#if onpaste}
							<button
								type="button"
								class="hearth-button secondary pressable paste"
								use:Ripple={PRESS_RIPPLE}
								onclick={() => (pasting = true)}
							>
								<Icon name="content_paste" size={ICON.inline} />
								{$lang('hearth_paste_yaml')}
							</button>
						{/if}
					</div>
					<div class="kinds" role="listbox" aria-label={$lang(label)}>
						{#each sections as section (section.id)}
							<div
								class="section"
								role="group"
								aria-labelledby={section.label ? `${uid}-${section.id}` : undefined}
							>
								{#if section.label}
									<div class="group-heading" id="{uid}-{section.id}">{$lang(section.label)}</div>
								{/if}
								<div class="grid">
									{#each section.kinds as kind (kind.type)}
										<div
											class="kind pressable"
											class:selected={kind.type === selected}
											role="option"
											aria-selected={kind.type === selected}
											tabindex="0"
											use:Ripple={PRESS_RIPPLE}
											onclick={() => pick(kind.type)}
											ondblclick={paned ? () => confirm(kind.type) : undefined}
											onkeydown={(event) => keydown(event, kind.type)}
										>
											<span class="kind-icon"><Icon name={kind.icon} size={ICON.control} /></span>
											<span class="kind-copy">
												<span class="kind-name">{$lang(kind.name)}</span>
												<span class="kind-sub">{$lang(kind.sub)}</span>
											</span>
											{#if kind.type === selected && !paned}<Icon
													name="check"
													size={ICON.control}
												/>{/if}
										</div>
									{/each}
								</div>
							</div>
						{:else}
							<div class="no-match">{noMatch}</div>
						{/each}
					</div>
				{/if}
			</div>
			{#if paned && !pasting}
				<aside class="aside">
					<div class="aside-label">
						{$lang('hearth_preview')}{#if current}&nbsp;&middot; {$lang(current.name)}{/if}
					</div>
					<div class="preview">{@render preview?.()}</div>
					{#if previewHint}<p class="preview-hint">{previewHint}</p>{/if}
					<button
						type="button"
						class="hearth-button primary pressable confirm"
						disabled={!current}
						use:Ripple={PRESS_RIPPLE}
						onclick={() => current && confirm(current.type)}
					>
						{confirmLabel}
					</button>
				</aside>
			{/if}
		</div>
	{:else if current}
		<button
			type="button"
			class="row pressable"
			use:Ripple={PRESS_RIPPLE}
			onclick={() => (open = true)}
		>
			<span class="kind-icon"><Icon name={current.icon} size={ICON.control} /></span>
			<span class="row-copy">
				<small>{$lang(label)}</small>
				<strong>{$lang(current.name)}</strong>
			</span>
			<Icon name="expand_more" size={ICON.control} />
		</button>
	{/if}
</div>

<style>
	.type-gallery {
		margin-bottom: 18px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 14px;
		border-radius: var(--h-radius-sm);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		background: rgb(var(--h-surface-rgb) / calc(0.04 * var(--h-fill-scale)));
		color: var(--h-text-2);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	@media (hover: hover) {
		.row:hover {
			border-color: rgb(var(--h-accent-rgb) / calc(0.35 * var(--h-accent-scale)));
		}
	}

	.kind-icon {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		flex: none;
		border-radius: var(--h-radius-xs);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		color: var(--h-icon);
	}

	.row-copy {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.row-copy small {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-caption);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--h-label);
	}

	.row-copy strong {
		font-size: var(--h-type-emphasis);
		font-weight: 600;
	}

	.choices {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
	}

	.search-row {
		display: flex;
		gap: 10px;
	}

	.search {
		display: flex;
		flex: 1;
		min-width: 0;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 0 14px;
		border-radius: var(--h-radius-xs);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		background: rgb(var(--h-surface-rgb) / calc(0.05 * var(--h-fill-scale)));
		color: var(--h-text-6);
	}

	/*
	 * The accent border is the field's one focus mark, keyboard focus
	 * included: the dashboard's ring around the bare input would draw a
	 * square box inside the rounded one.
	 */
	.search:focus-within {
		border-color: rgb(var(--h-accent-rgb) / calc(0.55 * var(--h-accent-scale)));
	}

	.search input {
		flex: 1;
		min-width: 0;
		padding: 10px 0;
		border: none;
		background: none;
		font-family: inherit;
		font-size: var(--h-type-body);
		color: var(--h-text-2);
	}

	.search input:focus-visible {
		outline: none;
	}

	.search input::placeholder {
		color: var(--h-text-6);
	}

	/* iOS Safari zooms the page into any input set under 16px */
	@media (pointer: coarse) {
		.search input {
			font-size: max(var(--h-input-floor), var(--h-type-body));
		}
	}

	.collapse {
		display: grid;
		place-items: center;
		border: 0;
		background: none;
		color: var(--h-icon);
		cursor: pointer;
		padding: 0;
	}

	.paste {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 8px;
		font-weight: 500;
	}

	.kinds {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.group-heading {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-caption);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--h-label);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 8px;
	}

	.paned .grid {
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	}

	.kind {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: var(--h-radius-xs);
		border: 1px solid transparent;
		color: var(--h-text-3);
		cursor: pointer;
		user-select: none;
		-webkit-user-select: none;
	}

	.paned .kind {
		border-color: rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		background: rgb(var(--h-surface-rgb) / calc(0.04 * var(--h-fill-scale)));
	}

	.kind-copy {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.kind-name {
		font-size: var(--h-type-body);
		font-weight: 500;
	}

	.kind-sub {
		font-size: var(--h-type-label);
		color: var(--h-text-4);
	}

	.kind.selected,
	.paned .kind.selected {
		background: rgb(var(--h-accent-rgb) / calc(0.14 * var(--h-accent-scale)));
		border-color: rgb(var(--h-accent-rgb) / calc(0.3 * var(--h-accent-scale)));
	}

	.kind.selected .kind-icon,
	.kind.selected .kind-name {
		color: var(--h-accent-icon);
	}

	.no-match {
		padding: 12px;
		font-size: var(--h-type-secondary);
		color: var(--h-text-4);
		text-align: center;
	}

	/*
	 * Two panes: the kinds scroll on the left, the preview and the one action
	 * stay put on the right. The sheet hands the whole body over (its split
	 * mode), so the panes reach its edges.
	 */
	.type-gallery.paned {
		display: flex;
		margin-bottom: 0;
		min-height: 0;
	}

	.paned .panel {
		display: flex;
		flex: 1;
		min-width: 0;
		min-height: 0;
	}

	.paned .choices {
		flex: 1;
		overflow-y: auto;
		scrollbar-gutter: stable;
		padding: 20px 28px 28px;
	}

	.aside {
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: 420px;
		flex: none;
		min-height: 0;
		padding: 20px 28px;
		border-left: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		background: rgb(var(--h-surface-rgb) / calc(0.02 * var(--h-fill-scale)));
	}

	.aside-label {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-caption);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--h-label);
	}

	/* the card only shows here; taps go to the gallery, not to Home Assistant */
	.preview {
		flex: 0 1 auto;
		min-height: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.preview-hint {
		margin: 0;
		font-size: var(--h-type-secondary);
		line-height: 1.5;
		color: var(--h-text-4);
	}

	.confirm {
		margin-top: auto;
		width: 100%;
	}

	/* see breakpoints.ts */
	@media (max-width: 900px) {
		.grid,
		.paned .grid {
			grid-template-columns: 1fr;
		}

		/* no room for the preview: the hint and the action make a bar under the kinds */
		.paned .panel {
			flex-direction: column;
		}

		.paned .choices {
			padding: 18px;
		}

		.aside {
			width: auto;
			gap: 10px;
			padding: 12px 18px 16px;
			border-left: none;
			border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		}

		.aside-label,
		.preview {
			display: none;
		}
	}
</style>
