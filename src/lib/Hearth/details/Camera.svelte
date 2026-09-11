<script lang="ts">
	import CameraPlayer from '../CameraPlayer.svelte';

	let { entity }: { entity: string } = $props();
</script>

<div class="frame">
	<CameraPlayer {entity} stream controls />
</div>

<style>
	.frame {
		margin-top: 12px;
		border-radius: var(--h-radius-sm);
		overflow: hidden;
	}
</style>
