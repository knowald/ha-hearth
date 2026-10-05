<script lang="ts">
	import type { TemplateCard } from './descriptor';

	let { card }: { card: TemplateCard } = $props();
</script>

<!-- loaded on demand, so dashboards without a template card do not carry it -->
{#await import('./Content.svelte')}
	<div class="section" aria-busy="true"></div>
{:then Content}
	<Content.default {card} />
{/await}
