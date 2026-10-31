<script lang="ts">
	import type { OverviewCard } from '../../types';
	import HeaderCard from '../../HeaderCard.svelte';
	import { headerStatList } from '../../model/headerStats';

	let { card }: { card: Extract<OverviewCard, { type: 'header' }> } = $props();
</script>

<HeaderCard
	icon={card.icon}
	title={card.title ?? ''}
	subtitle={card.subtitle}
	stats={headerStatList(card)}
	backgroundImage={card.background_image}
/>
