<script lang="ts">
	import { timer } from '$lib/core/app/clock';
	import { selectedLanguage } from '$lib/core/i18n';
	import { clockTimeOptions } from '../clock';
	import { displayTimeZone, hearthConfig } from '../store';

	// reads like the rail clock it stands in for: same zone, same hour format
	let configuredClock = $derived($hearthConfig.rail.find((widget) => widget.type === 'clock'));
	let now = $derived($timer);
	let time = $derived(
		now.toLocaleTimeString(
			$selectedLanguage,
			clockTimeOptions($displayTimeZone, configuredClock?.hour_format)
		)
	);
	let date = $derived(
		now.toLocaleDateString($selectedLanguage, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			...($displayTimeZone ? { timeZone: $displayTimeZone } : {})
		})
	);
</script>

<time class="clock" datetime={now.toISOString()}>
	<span class="time">{time}</span>
	<span class="date">{date}</span>
</time>

<style>
	.clock {
		flex: none;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 0 4px;
		line-height: 1.15;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.time {
		font-size: var(--h-type-emphasis);
		font-weight: 600;
		color: var(--h-text-1);
	}

	.date {
		font-size: var(--h-type-label);
		color: var(--h-text-4);
	}
</style>
