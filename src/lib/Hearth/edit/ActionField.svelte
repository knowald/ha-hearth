<script lang="ts">
	import { dumpYaml, parseYaml } from '../yamlText';
	import { fill, lang } from '$lib/core/i18n';
	import type { ActionTarget } from '$lib/core/ha/commands';
	import { isLinkUrl, resolvePage } from '../config';
	import { hearthConfig } from '../store';
	import type { HearthAction } from '../types';
	import CheckField from './CheckField.svelte';
	import CodeField from './CodeField.svelte';
	import EntityField from './EntityField.svelte';
	import SelectField from './SelectField.svelte';
	import TextField from './TextField.svelte';

	let {
		label,
		value = $bindable(),
		valid = $bindable()
	}: {
		label: string;
		/** Unset is the surface's own behaviour. Left as it was while the form is invalid. */
		value?: HearthAction;
		/** False while the form holds no usable action; unset counts as usable. */
		valid?: boolean;
	} = $props();

	// remounted per row, so the initial value is all the form needs
	const initial = value;
	const initialTarget = initial?.action === 'perform-action' ? initial.target : undefined;
	// a pasted toggle or more-info may name another entity; the form keeps it
	const entityOverride =
		initial?.action === 'toggle' || initial?.action === 'more-info' ? initial.entity : undefined;

	let kind = $state<string>(initial?.action ?? 'default');
	let service = $state(initial?.action === 'perform-action' ? initial.perform_action : '');
	let targetEntity = $state([initialTarget?.entity_id ?? []].flat().join(', '));
	let dataText = $state(
		initial?.action === 'perform-action' && initial.data ? dumpYaml(initial.data).trimEnd() : ''
	);
	let page = $state(
		initial?.action === 'navigate'
			? (resolvePage($hearthConfig.rooms, initial.navigation_path) ?? initial.navigation_path)
			: ($hearthConfig.rooms[0]?.id ?? '')
	);
	let url = $state(initial?.action === 'url' ? initial.url_path : '');
	let confirm = $state(Boolean(initial?.confirmation));
	let confirmText = $state(
		typeof initial?.confirmation === 'object' ? initial.confirmation.text : ''
	);

	let pageOptions = $derived([
		...$hearthConfig.rooms.map((room) => ({ value: room.id, label: room.name })),
		// a Lovelace path that names no Hearth page stays visible instead of
		// silently turning into the first page
		...($hearthConfig.rooms.some((room) => room.id === page) || !page
			? []
			: [{ value: page, label: fill($lang('hearth_action_unknown_page'), { path: page }) }])
	]);

	let serviceError = $derived(
		kind === 'perform-action' && !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(service.trim())
			? $lang('hearth_action_service_invalid')
			: null
	);
	let urlError = $derived(
		kind === 'url' && !isLinkUrl(url.trim()) ? $lang('hearth_action_url_invalid') : null
	);
	// CodeField reports why the text does not parse; this only decides validity
	let data = $derived.by((): { ok: boolean; value?: Record<string, unknown> } => {
		if (!dataText.trim()) return { ok: true };
		const parsed = parseYaml(dataText).value;
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? { ok: true, value: parsed as Record<string, unknown> }
			: { ok: false };
	});

	function performTarget(): ActionTarget | undefined {
		const ids = targetEntity
			.split(',')
			.map((id) => id.trim())
			.filter(Boolean);
		const target: ActionTarget = { ...initialTarget, entity_id: ids.length > 1 ? ids : ids[0] };
		if (target.entity_id === undefined) delete target.entity_id;
		return Object.keys(target).length ? target : undefined;
	}

	function build(): HearthAction | undefined {
		const text = confirmText.trim();
		const confirmation = confirm ? (text ? { text } : (true as const)) : undefined;
		switch (kind) {
			case 'none':
				return { action: 'none' };
			case 'toggle':
			case 'more-info':
				return { action: kind, entity: entityOverride, confirmation };
			case 'perform-action':
				return {
					action: 'perform-action',
					perform_action: service.trim(),
					target: performTarget(),
					data: data.value,
					confirmation
				};
			case 'navigate':
				return { action: 'navigate', navigation_path: page, confirmation };
			case 'url':
				return { action: 'url', url_path: url.trim(), confirmation };
			default:
				// stored only when it asks first; otherwise unset means the same
				return confirmation ? { action: 'default', confirmation } : undefined;
		}
	}

	// the form as it opened stands for the stored action even where it spells it
	// differently (a Lovelace path, a one-item list), so opening it is no edit
	const openedAs = JSON.stringify(build());

	$effect(() => {
		const ok = !serviceError && !urlError && data.ok && (kind !== 'navigate' || Boolean(page));
		if ((valid ?? true) !== ok) valid = ok;
		if (!ok) return;
		const next = build();
		value = JSON.stringify(next) === openedAs ? initial : next;
	});
</script>

<SelectField
	{label}
	bind:value={kind}
	options={[
		{ value: 'default', label: $lang('hearth_default') },
		{ value: 'toggle', label: $lang('toggle') },
		{ value: 'more-info', label: $lang('hearth_action_more_info') },
		{ value: 'perform-action', label: $lang('hearth_action_perform') },
		{ value: 'navigate', label: $lang('hearth_action_navigate') },
		{ value: 'url', label: $lang('hearth_action_url') },
		{ value: 'none', label: $lang('hearth_action_none') }
	]}
/>
{#if kind === 'perform-action'}
	<TextField
		label={$lang('hearth_action_service')}
		bind:value={service}
		placeholder="script.turn_on"
		error={serviceError}
	/>
	<EntityField label={$lang('hearth_action_target')} bind:value={targetEntity} />
	<CodeField
		label={$lang('hearth_action_data')}
		bind:value={dataText}
		placeholder="brightness_pct: 40"
	/>
{:else if kind === 'navigate'}
	<SelectField label={$lang('hearth_page')} bind:value={page} options={pageOptions} />
{:else if kind === 'url'}
	<TextField
		label={$lang('hearth_url')}
		bind:value={url}
		placeholder="https://example.com"
		error={urlError}
	/>
{/if}
{#if kind !== 'none'}
	<CheckField label={$lang('hearth_action_confirm')} bind:checked={confirm} />
	{#if confirm}
		<TextField
			label={$lang('hearth_action_confirm_text')}
			bind:value={confirmText}
			placeholder={$lang('hearth_action_confirm_title')}
		/>
	{/if}
{/if}
