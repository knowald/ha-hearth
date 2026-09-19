<script lang="ts">
	import { untrack } from 'svelte';
	import { lang } from '$lib/core/i18n';
	import { SWATCH_COLORS } from '$lib/core/theme';
	import {
		clampUnit,
		hexToHsv,
		hsvToHex,
		hueHex,
		normalizeHex,
		type Hsv
	} from '$lib/core/theme/color';
	import { areaDrag } from '$lib/ui/actions/areaDrag';
	import { activateOnKeyboard } from '../interaction';

	let { value, onchange }: { value: string; onchange: (value: string) => void } = $props();

	// deliberately the opening value: the effect below takes over the syncing
	let hsv = $state<Hsv>(untrack(() => hexToHsv(value)));
	let text = $state(untrack(() => normalizeHex(value) ?? '#000000'));

	let hex = $derived(hsvToHex(hsv));
	let hue = $derived(hueHex(hsv.h));

	/*
	 * Follows the field when something else changes the colour - a preset, or a
	 * picker whose derived siblings include this knob - without fighting the
	 * drag that is currently emitting.
	 */
	$effect(() => {
		const next = normalizeHex(value);
		if (!next) return;
		untrack(() => {
			if (next === hsvToHex(hsv)) return;
			const incoming = hexToHsv(next);
			// a grey carries no hue of its own; leave the strip where the user put it
			hsv = { ...incoming, h: incoming.s === 0 ? hsv.h : incoming.h };
			text = next;
		});
	});

	function emit(next: Hsv) {
		hsv = next;
		text = hsvToHex(next);
		onchange(text);
	}

	function pick(hexValue: string) {
		const next = normalizeHex(hexValue);
		if (!next) return;
		const incoming = hexToHsv(next);
		hsv = { ...incoming, h: incoming.s === 0 ? hsv.h : incoming.h };
		text = next;
		onchange(next);
	}

	function commitText(entered: string) {
		const next = normalizeHex(entered);
		// an unparseable entry snaps back rather than silently keeping the colour
		text = next ?? hex;
		if (next && next !== hex) pick(next);
	}

	const STEP = 0.02;
	const HUE_STEP = 4;

	function nudge(event: KeyboardEvent, axis: 'area' | 'hue') {
		const horizontal = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
		const vertical = event.key === 'ArrowDown' ? -1 : event.key === 'ArrowUp' ? 1 : 0;
		if (!horizontal && !vertical) return;
		event.preventDefault();
		if (axis === 'hue') {
			emit({ ...hsv, h: (hsv.h + horizontal * HUE_STEP + 360) % 360 });
			return;
		}
		emit({
			...hsv,
			s: clampUnit(hsv.s + horizontal * STEP),
			v: clampUnit(hsv.v + vertical * STEP)
		});
	}
</script>

<div class="picker">
	<div
		class="area"
		style:--picker-hue={hue}
		role="slider"
		tabindex="0"
		aria-label={$lang('color')}
		aria-valuetext={hex}
		aria-valuenow={Math.round(hsv.s * 100)}
		aria-valuemin={0}
		aria-valuemax={100}
		onkeydown={(event) => nudge(event, 'area')}
		use:areaDrag={{ move: (x, y) => emit({ ...hsv, s: x, v: 1 - y }) }}
	>
		<div
			class="thumb"
			style:left="{hsv.s * 100}%"
			style:top="{(1 - hsv.v) * 100}%"
			style:background={hex}
		></div>
	</div>

	<div
		class="hue"
		role="slider"
		tabindex="0"
		aria-label={$lang('hearth_hue')}
		aria-valuetext={hue}
		aria-valuenow={Math.round(hsv.h)}
		aria-valuemin={0}
		aria-valuemax={360}
		onkeydown={(event) => nudge(event, 'hue')}
		use:areaDrag={{ move: (x) => emit({ ...hsv, h: x * 360 }) }}
	>
		<div
			class="thumb"
			style:left="{(hsv.h / 360) * 100}%"
			style:top="50%"
			style:background={hue}
		></div>
	</div>

	<div class="swatches">
		{#each SWATCH_COLORS as swatch (swatch)}
			<div
				class="swatch pressable"
				class:selected={swatch.toLowerCase() === hex}
				style:background={swatch}
				role="button"
				tabindex="0"
				aria-label={`${$lang('color')} ${swatch}`}
				aria-pressed={swatch.toLowerCase() === hex}
				onclick={() => pick(swatch)}
				onkeydown={(event) => activateOnKeyboard(event, () => pick(swatch))}
			></div>
		{/each}
	</div>

	<label class="hex">
		<span class="hash">#</span>
		<input
			value={text.slice(1)}
			spellcheck="false"
			maxlength="6"
			aria-label={$lang('color')}
			onchange={(event) => commitText(event.currentTarget.value)}
		/>
	</label>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-top: 10px;
	}

	.area {
		position: relative;
		height: 132px;
		border-radius: var(--h-radius-xs);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.12 * var(--h-line-scale)));
		touch-action: none;
		cursor: crosshair;
		background:
			/* literal ok: the ramps of a saturation and value square are the picker's subject */
			linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, var(--picker-hue));
	}

	.hue {
		position: relative;
		height: 18px;
		border-radius: var(--h-radius-pill);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.12 * var(--h-line-scale)));
		touch-action: none;
		cursor: ew-resize;
		background: linear-gradient(
			/* literal ok: the hue wheel laid flat is the axis itself, not a palette */ to right,
			#f00 0%,
			#ff0 17%,
			#0f0 33%,
			#0ff 50%,
			#00f 67%,
			#f0f 83%,
			#f00 100%
		);
	}

	.thumb {
		position: absolute;
		width: 14px;
		height: 14px;
		margin: -8px 0 0 -8px;
		border-radius: var(--h-radius-pill);
		border: 2px solid #fff; /* literal ok: a ring that must read on any colour under it */
		box-shadow: 0 1px 4px var(--h-scrim);
		pointer-events: none;
	}

	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.swatch {
		width: 24px;
		height: 24px;
		border-radius: var(--h-radius-pill);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.15 * var(--h-line-scale)));
		cursor: pointer;
	}

	.swatch.selected {
		border-color: var(--h-accent-text);
		transform: scale(1.12);
	}

	.hex {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 10px;
		border-radius: var(--h-radius-xs);
		background: var(--h-track);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
	}

	.hash {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-secondary);
		color: var(--h-text-5);
	}

	.hex input {
		width: 100%;
		border: 0;
		background: none;
		outline: none;
		color: var(--h-text-2);
		font-family: var(--h-font-mono);
		font-size: var(--h-type-secondary);
		letter-spacing: 1px;
		text-transform: lowercase;
	}
</style>
