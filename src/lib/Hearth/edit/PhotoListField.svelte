<script lang="ts">
	import { ICON } from '../iconSizes';
	import { fill, lang } from '$lib/core/i18n';
	import { IMAGE_TYPES } from '$lib/core/images';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from '../config';
	import { imageSource, uploadImage } from '../images';
	import FieldMessages from './FieldMessages.svelte';
	import LoadingState from '../LoadingState.svelte';
	import Icon from '../Icon.svelte';

	const uid = $props.id();

	let {
		label,
		value = [],
		hint = undefined,
		onchange
	}: {
		label: string;
		/** `hearth-images/<file>` references, in showing order. */
		value?: string[];
		hint?: string;
		onchange: (value: string[]) => void;
	} = $props();

	let fileInput = $state<HTMLInputElement>();
	let uploading = $state(0);
	let error = $state('');

	// one file at a time keeps a weak tablet from re-encoding a dozen photos at once
	async function upload(event: Event & { currentTarget: HTMLInputElement }) {
		const files = [...(event.currentTarget.files ?? [])];
		// cleared so picking the same files again still fires change
		event.currentTarget.value = '';
		if (!files.length) return;
		error = '';
		const added: string[] = [];
		let failures = 0;
		let reason = '';
		for (const [index, file] of files.entries()) {
			uploading = files.length - index;
			try {
				added.push(await uploadImage(file));
			} catch (err) {
				console.error(err);
				failures += 1;
				if (!reason && err instanceof Error) reason = err.message;
			}
		}
		uploading = 0;
		if (failures) {
			error = `${fill($lang('hearth_photos_upload_failed'), { count: failures })}${reason ? `: ${reason}` : ''}`;
		}
		if (added.length) onchange([...new Set([...value, ...added])]);
	}

	function remove(photo: string) {
		onchange(value.filter((entry) => entry !== photo));
	}
</script>

<div class="field" role="group" aria-labelledby="{uid}-label">
	<div class="field-label" id="{uid}-label">{label}</div>
	<div class="grid">
		{#each value as photo, index (photo)}
			<div class="cell">
				<img src={imageSource(photo)} alt="" loading="lazy" />
				<button
					type="button"
					class="remove"
					aria-label={fill($lang('hearth_remove_photo'), { number: index + 1 })}
					onclick={() => remove(photo)}
				>
					<Icon name="close" size={ICON.inline} />
				</button>
			</div>
		{/each}
		<button
			type="button"
			class="add pressable"
			disabled={uploading > 0}
			use:Ripple={PRESS_RIPPLE}
			onclick={() => fileInput?.click()}
		>
			<Icon name="add_photo_alternate" size={ICON.control} />
			<span>{$lang('hearth_add_photos')}</span>
		</button>
	</div>
	<input
		bind:this={fileInput}
		class="file"
		type="file"
		multiple
		accept={Object.values(IMAGE_TYPES).join(',')}
		tabindex="-1"
		aria-hidden="true"
		onchange={upload}
	/>
	{#if uploading}
		<LoadingState inline text={fill($lang('hearth_uploading_photos'), { count: uploading })} />
	{/if}
	<FieldMessages id={uid} {hint} {error} />
</div>

<style>
	.field {
		display: block;
		margin-bottom: 14px;
	}

	.field-label {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-label);
		margin-bottom: 6px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
		gap: 8px;
	}

	.cell,
	.add {
		position: relative;
		aspect-ratio: 4 / 3;
		border-radius: var(--h-radius-xs);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		overflow: hidden;
	}

	.cell img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		background: var(--h-inset);
	}

	.remove {
		position: absolute;
		top: 4px;
		right: 4px;
		display: grid;
		place-items: center;
		padding: 4px;
		border: 0;
		border-radius: var(--h-radius-pill);
		background: var(--h-overlay);
		color: var(--h-text-2);
		cursor: pointer;
	}

	@media (pointer: coarse) {
		.remove {
			min-width: var(--h-touch-target);
			min-height: var(--h-touch-target);
			top: 0;
			right: 0;
		}
	}

	@media (hover: hover) {
		.remove:hover {
			color: var(--h-bad-text);
		}
	}

	.add {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 4px;
		background: var(--h-track);
		color: var(--h-icon);
		font-family: inherit;
		font-size: var(--h-type-small);
		cursor: pointer;
	}

	.add:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.file {
		display: none;
	}
</style>
