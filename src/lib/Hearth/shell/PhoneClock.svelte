<script lang="ts">
	import { timer } from '$lib/core/app/clock';
	import { selectedLanguage } from '$lib/core/i18n';
	import { clockTimeOptions } from '../clock';
	import { displayTimeZone, railClock } from '../store';

	// inline sets the date beside the time, for the phone header's single row
	let { inline = false }: { inline?: boolean } = $props();

	let now = $derived($timer);
	let time = $derived(
		now.toLocaleTimeString(
			$selectedLanguage,
			clockTimeOptions($displayTimeZone, $railClock?.hour_format)
		)
	);
	// to the minute, matching what the strip shows
	let stamp = $derived(now.toISOString().slice(0, 16) + 'Z');
	let date = $derived(
		now.toLocaleDateString($selectedLanguage, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			...($displayTimeZone ? { timeZone: $displayTimeZone } : {})
		})
	);
</script>

<time class="clock" class:inline datetime={stamp}>
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

	.clock.inline {
		flex-direction: row;
		align-items: baseline;
		gap: 10px;
		padding: 0;
	}

	.clock.inline .date {
		font-size: var(--h-type-body);
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
