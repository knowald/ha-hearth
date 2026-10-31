<script lang="ts">
	import { ICON } from './iconSizes';
	import { lang } from '$lib/core/i18n';
	import { activateOnKeyboard } from './interaction';
	import { hearthConfig, hearthEditMode } from './store';
	import { imageSource } from './images';
	import { sensorNumber, states, UNAVAILABLE_STATES } from '$lib/core/ha/entities';
	import { formatReading } from './format';
	import type { ShownStat } from './model/headerStats';
	import Icon from './Icon.svelte';
	import type { HassEntity } from 'home-assistant-js-websocket';

	let {
		icon = 'home',
		title = '',
		subtitle = undefined,
		stats = [],
		backgroundImage = undefined,
		onedit = undefined
	}: {
		icon?: string;
		title?: string;
		subtitle?: string;
		/** The readings at the right, in order; see headerStatList. */
		stats?: ShownStat[];
		/** A URL, or `hearth-images/<file>` for an uploaded image. */
		backgroundImage?: string;
		onedit?: () => void;
	} = $props();

	let editable = $derived($hearthEditMode && !!onedit);

	let background = $derived(imageSource(backgroundImage));
	// the source that failed rather than a flag, so a new image is tried again
	let failedBackground = $state<string>();
	let banner = $derived(!!background && background !== failedBackground);

	// temperature and humidity keep the short form the header always had
	function readingText(entity: HassEntity | undefined, kind: ShownStat['kind']): string {
		const value = sensorNumber(entity?.state);
		if (kind === 'temperature') return value === null ? '-' : `${value.toFixed(1)}\u00b0`;
		if (kind === 'humidity') return value === null ? '-' : `${Math.round(value)}%`;
		if (value !== null) return formatReading(value, entity?.attributes?.unit_of_measurement);
		return !entity || UNAVAILABLE_STATES.includes(entity.state) ? '-' : entity.state;
	}

	let readings = $derived(
		stats.map((stat) => {
			const entity = $states?.[stat.entity];
			const deviceClass = entity?.attributes?.device_class;
			const kind =
				stat.kind ??
				(deviceClass === 'temperature' || deviceClass === 'humidity' ? deviceClass : undefined);
			const kindLabel = kind && $lang(kind === 'temperature' ? 'hearth_temp' : 'hearth_humidity');
			return {
				entity: stat.entity,
				value: readingText(entity, kind),
				label: stat.name ?? kindLabel ?? entity?.attributes?.friendly_name ?? stat.entity
			};
		})
	);
</script>

{#snippet content()}
	{#if background && background !== failedBackground}
		<img
			class="backdrop"
			src={background}
			alt=""
			decoding="async"
			onerror={() => (failedBackground = background)}
		/>
	{/if}
	<div class="icon-tile">
		<Icon name={icon || 'home'} size={ICON.hero} color="var(--h-accent-text)" />
	</div>
	<div class="titles">
		<div class="name">{title}</div>
		<div class="summary">{subtitle ?? ''}</div>
		{#if $hearthConfig.greeting && !$hearthEditMode}
			{#await import('./Greeting.svelte') then Greeting}
				<Greeting.default />
			{/await}
		{/if}
	</div>
	{#if editable}
		<div class="edit-hint">
			<Icon name="edit" size={ICON.control} />
		</div>
	{/if}
	{#if readings.length}
		<div class="stats">
			{#each readings as reading, index (index)}
				<div class="stat" data-entity={reading.entity}>
					<div class="stat-value">{reading.value}</div>
					<div class="stat-label">{reading.label}</div>
				</div>
			{/each}
		</div>
	{/if}
{/snippet}

<!-- a control only while there is something to edit; otherwise plain content -->
{#if editable && onedit}
	<div
		class="header editable"
		class:banner
		role="button"
		tabindex="0"
		onclick={onedit}
		onkeydown={(event) => activateOnKeyboard(event, onedit)}
	>
		{@render content()}
	</div>
{:else}
	<div class="header" class:banner>{@render content()}</div>
{/if}

<style>
	.header {
		display: flex;
		align-items: center;
		/* the readings drop under the title before the title wraps per word */
		flex-wrap: wrap;
		gap: 18px;
	}

	.header.editable {
		cursor: pointer;
	}

	.header.banner {
		position: relative;
		isolation: isolate;
		padding: 24px;
		border-radius: var(--h-radius-card);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.07 * var(--h-line-scale)));
		box-shadow: var(--h-card-shadow);
		overflow: hidden;
	}

	/* a wash of the theme's own background keeps title and readings legible over
	   any photo, in light and dark themes alike; as ::after it paints over the
	   image, which shares its layer */
	.header.banner::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--h-bg-1) 82%, transparent),
			color-mix(in srgb, var(--h-bg-1) 30%, transparent)
		);
	}

	.backdrop {
		position: absolute;
		inset: 0;
		z-index: -1;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.edit-hint {
		color: var(--h-icon);
	}

	.icon-tile {
		width: 64px;
		height: 64px;
		border-radius: var(--h-radius-md);
		background: rgb(var(--h-accent-rgb) / calc(0.14 * var(--h-accent-scale)));
		border: 1px solid rgb(var(--h-accent-rgb) / calc(0.22 * var(--h-accent-scale)));
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
	}

	.titles {
		flex: 1 1 180px;
		min-width: 0;
	}

	.name {
		font-size: var(--h-type-display-sm);
		font-weight: 600;
		color: var(--h-text-1);
		letter-spacing: -0.5px;
	}

	.summary {
		font-size: var(--h-type-body);
		color: var(--h-text-5);
	}

	.stats {
		display: flex;
		align-items: center;
		gap: 20px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		text-align: right;
		line-height: 1.2;
	}

	.stat + .stat {
		padding-left: 20px;
		border-left: 1px solid rgb(var(--h-line-rgb) / calc(0.12 * var(--h-line-scale)));
	}

	.stat-value {
		font-size: var(--h-type-headline);
		font-weight: 500;
		color: var(--h-text-1);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.stat-label {
		font-size: var(--h-type-small);
		color: var(--h-text-5);
		white-space: nowrap;
	}
</style>
