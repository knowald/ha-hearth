<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { editor } from '../store';
	import EditSheet from './EditSheet.svelte';
	import ServerSection from './settings/ServerSection.svelte';

	let section = $state<ServerSection>();
	let dirty = $state(false);
	let saving = $state(false);
</script>

<EditSheet
	title={$lang('hearth_server_settings')}
	onclose={() => editor.set(null)}
	onback={() => editor.set({ kind: 'settings' })}
	{dirty}
	ondone={() => section?.save()}
	doneLabel={$lang('save')}
	doneDisabled={saving}
>
	<div class="settings">
		<ServerSection bind:this={section} bind:dirty bind:saving onsaved={() => editor.set(null)} />
	</div>
</EditSheet>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 18px;
		max-width: 560px;
		margin: 0 auto;
		width: 100%;
	}
</style>
