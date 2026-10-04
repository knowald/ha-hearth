<script lang="ts">
	import { ICON } from '../../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { activateOnKeyboard } from '../../interaction';
	import type { CardEditorProps } from '../types';
	import type { MediaCard } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';
	import Icon from '../../Icon.svelte';
	import TextField from '../../edit/TextField.svelte';

	let { initial: initialProp, onchange }: CardEditorProps<MediaCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const initial = initialProp;

	const form = new EditorForm(initial, [
		{ key: 'entity', kind: 'entity', required: true, domains: ['media_player'] },
		{
			key: 'default_device',
			kind: 'text',
			label: 'hearth_default_device',
			example: 'hearth_example_speaker'
		}
	]);
	let shortcuts = $state(
		(initial?.shortcuts ?? []).map((shortcut) => ({
			name: shortcut.name,
			uri: shortcut.uri,
			image_url: shortcut.image_url ?? ''
		}))
	);

	function addShortcut() {
		shortcuts.push({ name: '', uri: '', image_url: '' });
	}

	$effect(() => {
		const list = shortcuts
			.map((shortcut) => ({
				name: shortcut.name.trim(),
				uri: shortcut.uri.trim(),
				image_url: shortcut.image_url.trim() || undefined
			}))
			.filter((shortcut) => shortcut.name && shortcut.uri);
		onchange({
			fields: { ...form.stored, shortcuts: list.length ? list : undefined },
			...form.validity
		});
	});
</script>

<FormRenderer {form} />
<div class="group-label">{$lang('hearth_quick_play')}</div>
<div class="hint">{$lang('hearth_shortcuts_hint')}</div>
{#each shortcuts as shortcut, index (index)}
	<div class="filter-row">
		<div class="filter-fields">
			<TextField
				label={$lang('name')}
				bind:value={shortcut.name}
				placeholder={$lang('hearth_example_shortcut_name')}
			/>
			<TextField
				label={$lang('hearth_shortcut_uri')}
				bind:value={shortcut.uri}
				placeholder="spotify:playlist:..."
			/>
			<TextField
				label={$lang('hearth_shortcut_image')}
				bind:value={shortcut.image_url}
				placeholder="https://"
			/>
		</div>
		<button
			type="button"
			class="remove"
			aria-label={$lang('hearth_remove_shortcut')}
			onclick={() => shortcuts.splice(index, 1)}
		>
			<Icon name="delete" size={ICON.control} />
		</button>
	</div>
{/each}
<div
	class="add-filter"
	role="button"
	tabindex="0"
	onclick={addShortcut}
	onkeydown={(event) => activateOnKeyboard(event, addShortcut)}
>
	<Icon name="add" size={ICON.control} />
	<span>{$lang('hearth_add_shortcut')}</span>
</div>
