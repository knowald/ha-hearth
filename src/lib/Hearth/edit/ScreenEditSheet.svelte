<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { screenSheetOpen } from '../screen';
	import EditSheet from './EditSheet.svelte';
	import ScreenSection from './settings/ScreenSection.svelte';

	function close() {
		screenSheetOpen.set(false);
	}
</script>

<!-- every row applies as it changes, so the header action only closes -->
<EditSheet
	title={$lang('hearth_this_screen')}
	onclose={close}
	ondone={close}
	doneLabel={$lang('hearth_close')}
>
	<div class="settings">
		<ScreenSection />
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
