<script lang="ts">
	import { timer } from '$lib/core/app/clock';
	import { states } from '$lib/core/ha/entities';
	import { fill, lang, selectedLanguage } from '$lib/core/i18n';
	import { ICON } from './iconSizes';
	import Icon from './Icon.svelte';
	import { displayTimeZone, hearthConfig } from './store';
	import {
		arrivalsToGreet,
		dayPart,
		type DayPart,
		dismissedGreetings,
		dismissGreeting,
		recentArrivals
	} from './greeting';

	/** `sleep` drops the dismiss button: on the sleep screen any tap wakes it instead. */
	let { variant = 'header' }: { variant?: 'header' | 'sleep' } = $props();

	const GREETINGS: Record<DayPart, string> = {
		morning: 'hearth_greeting_morning',
		afternoon: 'hearth_greeting_afternoon',
		evening: 'hearth_greeting_evening',
		night: 'hearth_greeting_night'
	};

	let arrivals = $derived(
		arrivalsToGreet(
			recentArrivals($states, $hearthConfig.greeting, $timer.getTime()),
			$timer.getTime(),
			$dismissedGreetings
		)
	);

	let text = $derived.by(() => {
		if (!arrivals.length) return '';
		const names = arrivals.map((arrival) => arrival.name);
		let joined: string;
		try {
			joined = new Intl.ListFormat($selectedLanguage || 'en', { type: 'conjunction' }).format(
				names
			);
		} catch {
			joined = names.join(', ');
		}
		return fill($lang(GREETINGS[dayPart($timer, $displayTimeZone)]), { name: joined });
	});
</script>

{#if text}
	<div class="greeting {variant}" role="status">
		<span class="text">{text}</span>
		{#if variant === 'header'}
			<button
				type="button"
				class="dismiss"
				aria-label={$lang('hearth_dismiss')}
				onclick={() => dismissGreeting(arrivals)}
			>
				<Icon name="close" size={ICON.inline} />
			</button>
		{/if}
	</div>
{/if}

<style>
	.greeting {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		max-width: 100%;
	}

	.greeting.header {
		margin-top: 8px;
		padding: 0 0 0 12px;
		border-radius: var(--h-radius-pill);
		background: rgb(var(--h-accent-rgb) / calc(0.1 * var(--h-accent-scale)));
		color: var(--h-accent-text);
		font-size: var(--h-type-secondary);
	}

	.greeting.sleep {
		margin-top: 12px;
		font-size: var(--h-type-subtitle);
		color: rgb(var(--h-line-rgb) / calc(var(--screensaver-brightness, 0.32) * 0.75));
	}

	.text {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.dismiss {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: var(--h-radius-pill);
		background: none;
		color: inherit;
		cursor: pointer;
	}
</style>
