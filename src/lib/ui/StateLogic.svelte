<script lang="ts">
	import { lang, selectedLanguage, fill } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import { isTimestamp, relativeTime } from '$lib/core/i18n/time';
	import { getDomain } from '$lib/core/ha/entities';

	let { entity_id }: { entity_id: string | undefined } = $props();
	let entity = $derived(entity_id ? $states?.[entity_id] : undefined);

	let attributes = $derived(entity?.attributes);
	let entityState = $derived(entity?.state);
	let brightness = $derived(attributes?.brightness);
	let percentage = $derived(attributes?.percentage);
	let media_title = $derived(attributes?.media_title);

	const BLANK = '\u00a0';
</script>

<!-- Light -->
{#if entityState === 'on' && brightness}
	{@const percentage = brightness / 255}
	<!-- should never be 0% if on -->
	{@const floor = percentage < 0.01 && percentage > 0 ? 0.01 : percentage}
	{Intl.NumberFormat($selectedLanguage, { style: 'percent' }).format(floor)}

	<!-- Media -->
{:else if media_title && entityState === 'playing'}
	<span title={media_title}>{media_title}</span>

	<!-- Climate -->
{:else if getDomain(entity_id) === 'climate' && attributes?.hvac_action}
	{$lang(attributes?.hvac_action)}

	<!-- Climate -->
{:else if getDomain(entity_id) === 'update'}
	{#if attributes?.in_progress}
		{typeof attributes?.in_progress === 'number'
			? fill($lang('update_installing_progress'), { progress: String(attributes?.in_progress) })
			: $lang('update_installing')}
	{:else if entityState === 'on'}
		{$lang('update_available')}
	{:else if entityState === 'off'}
		{$lang('update_up_to_date')}
	{/if}

	<!-- Automation -->
{:else if getDomain(entity_id) === 'automation' && entity?.attributes?.current > 0}
	{$lang('running')}

	<!-- Script -->
{:else if getDomain(entity_id) === 'script' && entity?.attributes?.current > 0}
	{$lang('running')}

	<!-- Humidifier -->
{:else if getDomain(entity_id) === 'humidifier' && entityState === 'on' && attributes?.action}
	{$lang('humidifier_' + attributes?.action)}

	<!-- Water Heater -->
{:else if getDomain(entity_id) === 'water_heater'}
	{$lang('water_heater_' + entityState)}

	<!-- Input Number / Number -->
{:else if entity_id && (getDomain(entity_id) === 'input_number' || getDomain(entity_id) === 'number')}
	{Number.isFinite(Number(entityState)) ? Number(entityState) : $lang('unknown')}
	{#if attributes?.unit_of_measurement}{attributes.unit_of_measurement}{/if}

	<!-- Weather -->
{:else if getDomain(entity_id) === 'weather'}
	{$lang('weather_' + entityState?.replace('_', '-')) || entityState || $lang('unknown')}

	<!-- Text -->
{:else if getDomain(entity_id) === 'input_text' || getDomain(entity_id) === 'text'}
	{#if entityState === 'unknown'}
		{$lang('unknown')}
	{:else if entityState === ''}
		{BLANK}
	{:else}
		{attributes?.mode === 'password' ? entityState?.replace(/./g, '•') : entityState}
	{/if}

	<!-- Timestamp  -->
{:else if entityState && isTimestamp(entityState)}
	{relativeTime(entityState, $selectedLanguage)}

	<!-- Percentage  -->
{:else if entityState === 'on' && percentage}
	{Intl.NumberFormat($selectedLanguage, { style: 'percent' }).format(percentage * 0.01)}

	<!-- State  -->
{:else if entityState}
	{$lang(entityState)}

	<!-- Unit -->
	{#if attributes?.unit_of_measurement}
		{attributes.unit_of_measurement}
	{/if}
{:else}
	{$lang('unknown')}
{/if}
