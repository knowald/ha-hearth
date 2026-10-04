<script lang="ts">
	import { ICON } from '../../iconSizes';
	import { lang, fill, selectedLanguage } from '$lib/core/i18n';
	import { timer } from '$lib/core/app/clock';
	import { connection } from '$lib/core/ha/connection';
	import { states } from '$lib/core/ha/entities';
	import {
		createTodoList,
		sortTodoItems,
		todoAbilities,
		todoDue,
		type TodoDue,
		type TodoItem,
		type TodoList
	} from '$lib/core/domains/todo';
	import { getHearthInteractionMode, longPress } from '../../interaction';
	import { hearthEditMode, requestConfirmation } from '../../store';
	import EmptyState from '../../EmptyState.svelte';
	import Icon from '../../Icon.svelte';
	import type { TodoCard } from './descriptor';

	let { card }: { card: TodoCard } = $props();

	const preview = getHearthInteractionMode() !== 'runtime';
	// inert hands every tap to the card slot underneath, which edit mode owns
	let locked = $derived(preview || $hearthEditMode);

	let list = $state<TodoList | null>(null);
	let items = $state<TodoItem[] | null>(null);

	$effect(() => {
		const entityId = card.entity;
		if (!entityId || !$connection) return;
		const current = createTodoList(entityId);
		list = current;
		const unsubscribe = current.items.subscribe((value) => (items = value));
		return () => {
			unsubscribe();
			current.destroy();
			list = null;
			items = null;
		};
	});

	let abilities = $derived(
		todoAbilities(card.entity ? $states?.[card.entity]?.attributes?.supported_features : 0)
	);
	let open = $derived(
		sortTodoItems(
			(items ?? []).filter((item) => item.status === 'needs_action'),
			card.sort
		)
	);
	let completed = $derived(
		sortTodoItems(
			(items ?? []).filter((item) => item.status === 'completed'),
			card.sort
		)
	);

	// null follows show_completed, so the editor preview tracks the option
	let completedToggled = $state<boolean | null>(null);
	let completedOpen = $derived(completedToggled ?? card.show_completed ?? false);

	let draft = $state('');
	let renaming = $state<string | null>(null);
	let renameDraft = $state('');

	function add(event: SubmitEvent) {
		event.preventDefault();
		if (!list || !draft.trim()) return;
		list.add(draft);
		draft = '';
	}

	function toggle(item: TodoItem) {
		list?.setStatus(item.uid, item.status === 'completed' ? 'needs_action' : 'completed');
	}

	function startRename(item: TodoItem) {
		if (!abilities.update || item.local) return;
		renaming = item.uid;
		renameDraft = item.summary;
	}

	function finishRename(save: boolean) {
		const uid = renaming;
		renaming = null;
		if (!save || !uid) return;
		const item = items?.find((entry) => entry.uid === uid);
		const text = renameDraft.trim();
		if (item && text && text !== item.summary) list?.rename(uid, text);
	}

	function renameKey(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.isComposing) {
			event.preventDefault();
			finishRename(true);
		} else if (event.key === 'Escape') {
			// the sheet or dialog around a card must not close with it
			event.stopPropagation();
			finishRename(false);
		}
	}

	function askRemove(item: TodoItem) {
		if (!abilities.delete || item.local) return;
		requestConfirmation({
			title: $lang('hearth_todo_remove_title'),
			message: fill($lang('hearth_todo_remove_message'), { item: item.summary }),
			confirmLabel: $lang('remove'),
			action: () => list?.remove(item.uid)
		});
	}

	function removeKey(event: KeyboardEvent, item: TodoItem) {
		if (event.key !== 'Delete' && event.key !== 'Backspace') return;
		event.preventDefault();
		askRemove(item);
	}

	function askClearCompleted() {
		requestConfirmation({
			title: $lang('hearth_todo_clear_completed'),
			message: $lang('hearth_todo_clear_completed_message'),
			confirmLabel: $lang('remove'),
			action: () => list?.removeCompleted()
		});
	}

	function dueLabel(due: TodoDue): string {
		const day =
			due.days === 0
				? $lang('hearth_today')
				: due.days === 1
					? $lang('hearth_tomorrow')
					: due.days === -1
						? $lang('hearth_yesterday')
						: due.date.toLocaleDateString($selectedLanguage, { month: 'short', day: 'numeric' });
		if (!due.timed) return day;
		const time = due.date.toLocaleTimeString($selectedLanguage, {
			hour: '2-digit',
			minute: '2-digit'
		});
		return `${day} ${time}`;
	}

	function focusOnMount(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
</script>

{#snippet row(item: TodoItem)}
	{@const done = item.status === 'completed'}
	{@const due = todoDue(item.due, $timer)}
	{@const removable = abilities.delete && !item.local}
	<li
		class="item"
		class:done
		class:local={item.local}
		use:longPress={{ hold: () => askRemove(item), disabled: !removable || locked }}
	>
		<button
			type="button"
			role="checkbox"
			class="check"
			aria-checked={done}
			aria-label={item.summary}
			disabled={!abilities.update || item.local}
			onclick={() => toggle(item)}
		>
			<span class="mark">
				{#if done}<Icon name="check" size={ICON.inline} />{/if}
			</span>
		</button>
		{#if renaming === item.uid}
			<input
				class="rename"
				type="text"
				aria-label={fill($lang('hearth_todo_rename'), { item: item.summary })}
				bind:value={renameDraft}
				enterkeyhint="done"
				autocomplete="off"
				use:focusOnMount
				onkeydown={renameKey}
				onblur={() => finishRename(true)}
			/>
		{:else if (abilities.update || removable) && !item.local}
			<button
				type="button"
				class="text"
				aria-keyshortcuts={removable ? 'Delete' : undefined}
				onclick={() => startRename(item)}
				onkeydown={(event) => removeKey(event, item)}
			>
				<span class="summary">{item.summary}</span>
				{#if item.description}<span class="description">{item.description}</span>{/if}
			</button>
		{:else}
			<div class="text">
				<span class="summary">{item.summary}</span>
				{#if item.description}<span class="description">{item.description}</span>{/if}
			</div>
		{/if}
		{#if due}
			<span class="due" class:overdue={due.overdue && !done}>
				<Icon name="event" size={ICON.inline} />
				{dueLabel(due)}
			</span>
		{/if}
	</li>
{/snippet}

<div class="body" inert={locked}>
	{#if abilities.create && !card.hide_add}
		<form class="add" onsubmit={add}>
			<input
				type="text"
				bind:value={draft}
				placeholder={$lang('hearth_todo_add_placeholder')}
				aria-label={$lang('hearth_todo_add_placeholder')}
				enterkeyhint="done"
				autocomplete="off"
				disabled={!list}
			/>
			<button
				type="submit"
				class="add-button"
				aria-label={$lang('hearth_todo_add')}
				disabled={!list || !draft.trim()}
			>
				<Icon name="add" size={ICON.control} />
			</button>
		</form>
	{/if}

	{#if items && open.length === 0 && completed.length === 0}
		<EmptyState inline icon="task_alt" text={$lang('hearth_todo_empty')} />
	{:else if items}
		{#if open.length}
			<ul class="items">
				{#each open as item (item.uid)}{@render row(item)}{/each}
			</ul>
		{/if}
		{#if completed.length}
			<div class="completed-header">
				<button
					type="button"
					class="completed-toggle"
					aria-expanded={completedOpen}
					onclick={() => (completedToggled = !completedOpen)}
				>
					<Icon name={completedOpen ? 'expand_less' : 'expand_more'} size={ICON.control} />
					{fill($lang('hearth_todo_completed'), { count: completed.length })}
				</button>
				{#if completedOpen && abilities.delete}
					<button type="button" class="clear" onclick={askClearCompleted}>
						{$lang('hearth_todo_clear_completed')}
					</button>
				{/if}
			</div>
			{#if completedOpen}
				<ul class="items">
					{#each completed as item (item.uid)}{@render row(item)}{/each}
				</ul>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.body {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.add {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
	}

	.add input,
	.rename {
		flex: 1;
		min-width: 0;
		min-height: var(--h-touch-target);
		box-sizing: border-box;
		padding: 8px 12px;
		border-radius: var(--h-radius-xs);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		background: var(--h-track);
		color: var(--h-text-2);
		font-family: inherit;
		font-size: var(--h-type-body);
		outline: none;
	}

	.add input:focus,
	.rename:focus {
		border-color: rgb(var(--h-accent-rgb) / calc(0.4 * var(--h-accent-scale)));
	}

	/* iOS Safari zooms the page into any input set under 16px */
	@media (pointer: coarse) {
		.add input,
		.rename {
			font-size: max(var(--h-input-floor), var(--h-type-body));
		}
	}

	.add-button {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: var(--h-touch-target);
		height: var(--h-touch-target);
		padding: 0;
		border: 0;
		border-radius: var(--h-radius-xs);
		background: rgb(var(--h-accent-rgb) / calc(0.14 * var(--h-accent-scale)));
		color: var(--h-accent-icon);
		cursor: pointer;
	}

	.add-button:disabled {
		background: rgb(var(--h-surface-rgb) / calc(0.05 * var(--h-fill-scale)));
		color: var(--h-icon-dim);
		cursor: default;
	}

	.items {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: var(--h-touch-target);
		border-radius: var(--h-radius-xs);
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}

	.item.local {
		opacity: 0.6;
	}

	.check {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: var(--h-touch-target);
		height: var(--h-touch-target);
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}

	.check:disabled {
		cursor: default;
	}

	.mark {
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 2px solid rgb(var(--h-line-rgb) / calc(0.35 * var(--h-line-scale)));
		color: var(--h-on-accent);
		transition:
			background var(--h-motion-fast),
			border-color var(--h-motion-fast);
	}

	.done .mark {
		border-color: transparent;
		background: linear-gradient(135deg, var(--h-accent-deep), var(--h-accent-bright));
	}

	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		padding: 6px 4px;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
	}

	button.text {
		cursor: text;
	}

	.summary {
		overflow-wrap: anywhere;
		font-size: var(--h-type-body);
		color: var(--h-text-2);
	}

	.done .summary {
		color: var(--h-text-5);
		text-decoration: line-through;
	}

	.description {
		overflow-wrap: anywhere;
		font-size: var(--h-type-small);
		color: var(--h-text-5);
	}

	.due {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: var(--h-radius-pill);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		color: var(--h-text-4);
		font-size: var(--h-type-small);
		white-space: nowrap;
	}

	.due.overdue {
		background: rgb(var(--h-bad-rgb) / calc(0.12 * var(--h-accent-scale)));
		color: var(--h-bad-text);
	}

	.completed-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-top: 6px;
	}

	.completed-toggle,
	.clear {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: var(--h-touch-target);
		padding: 0 8px;
		border: 0;
		border-radius: var(--h-radius-xs);
		background: none;
		color: var(--h-text-4);
		font: inherit;
		font-size: var(--h-type-secondary);
		cursor: pointer;
	}

	.clear {
		color: var(--h-text-5);
	}
</style>
