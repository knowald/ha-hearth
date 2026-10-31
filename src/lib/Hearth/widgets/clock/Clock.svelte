<script lang="ts">
	import { timer } from '$lib/core/app/clock';
	import { lang, selectedLanguage } from '$lib/core/i18n';
	import {
		clockReading,
		clockTimeOptions,
		hourInTimeZone,
		validTimeZone,
		type ClockHourFormat
	} from '../../clock';

	let {
		timezone,
		hour_format = 'auto',
		show_seconds = false
	}: { timezone?: string; hour_format?: ClockHourFormat; show_seconds?: boolean } = $props();

	let now = $derived($timer);

	let activeTimezone = $derived(validTimeZone(timezone));
	let time = $derived(
		clockReading(
			now,
			$selectedLanguage,
			clockTimeOptions(activeTimezone, hour_format, show_seconds)
		)
	);
	let date = $derived(
		now.toLocaleDateString($selectedLanguage, {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			...(activeTimezone ? { timeZone: activeTimezone } : {})
		})
	);
	let hour = $derived(hourInTimeZone(now, $selectedLanguage, activeTimezone));
	let greeting = $derived(
		$lang(
			hour < 12
				? 'hearth_good_morning'
				: hour < 18
					? 'hearth_good_afternoon'
					: 'hearth_good_evening'
		)
	);
</script>

<div>
	<div class="clock">
		{#if time.period && time.periodFirst}<span class="period">{time.period}</span>{/if}
		<span>{time.digits}</span>
		{#if time.period && !time.periodFirst}<span class="period">{time.period}</span>{/if}
	</div>
	<div class="date">{date}</div>
	<div class="greeting">{greeting}</div>
</div>

<style>
	.clock {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 8px;
		font-size: var(--h-type-clock);
		font-weight: 600;
		line-height: 0.9;
		letter-spacing: -3px;
		color: var(--h-text-1);
	}

	/* set small and high, like a superscript, so the time keeps to one line */
	.period {
		margin-top: 6px;
		font-size: var(--h-type-headline);
		font-weight: 500;
		letter-spacing: 0;
		line-height: 1;
		color: var(--h-text-3);
	}

	.date {
		font-size: var(--h-type-emphasis);
		color: var(--h-text-4);
		margin-top: 10px;
		letter-spacing: 0.2px;
	}

	.greeting {
		font-size: var(--h-type-body);
		color: var(--h-text-5);
		margin-top: 2px;
	}

	/* see breakpoints.ts */
	@media (max-width: 900px) {
		.clock {
			font-size: var(--h-type-hero);
		}

		.period {
			margin-top: 2px;
			font-size: var(--h-type-small);
		}
	}
</style>
