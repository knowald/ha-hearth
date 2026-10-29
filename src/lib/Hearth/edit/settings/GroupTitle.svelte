<script lang="ts">
	let { title }: { title: string } = $props();
</script>

<!-- a run of rows inside a section, set off by its own small heading -->
<div class="group-title">{title}</div>

<style>
	.group-title {
		padding: 14px 16px 4px;
		border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-label);
	}
</style>
