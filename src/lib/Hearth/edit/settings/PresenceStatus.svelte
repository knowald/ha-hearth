<script lang="ts">
	import { states } from '$lib/core/ha/entities';
	import { fill, lang, selectedLanguage } from '$lib/core/i18n';
	import { relativeTime } from '$lib/core/i18n/time';
	import { presenceChangesAt } from '../../store';

	/*
	 * What the presence sensor reads right now and what that means for this
	 * screen, so the setting can be checked without walking away from it. An
	 * entity Home Assistant does not report is left to the field's own warning.
	 * The countdown is the screen's own, so the two never disagree.
	 */
	let { entity }: { entity: string } = $props();

	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 15_000);
		return () => clearInterval(timer);
	});

	let sensor = $derived($states?.[entity]);

	let text = $derived.by(() => {
		if (!sensor) return undefined;
		if (sensor.state === 'unavailable' || sensor.state === 'unknown')
			return $lang('hearth_presence_status_unavailable');
		if (sensor.state !== 'on' && sensor.state !== 'off')
			return fill($lang('hearth_presence_status_other'), { state: sensor.state });
		const changesAt = $presenceChangesAt;
		if (sensor.state === 'off' && changesAt !== undefined && changesAt > now)
			return fill($lang('hearth_presence_status_waiting'), {
				time: relativeTime(new Date(changesAt).toISOString(), $selectedLanguage)
			});
		const changed = Date.parse(sensor.last_changed);
		if (!Number.isFinite(changed)) return undefined;
		const time = relativeTime(new Date(Math.min(changed, now)).toISOString(), $selectedLanguage);
		return fill(
			$lang(sensor.state === 'on' ? 'hearth_presence_status_on' : 'hearth_presence_status_off'),
			{ time }
		);
	});
</script>

{#if text}
	<span class="field-hint presence-status" data-presence-status={sensor?.state}>{text}</span>
{/if}

<style>
	.presence-status {
		display: block;
		margin: 6px 0 0;
	}
</style>
