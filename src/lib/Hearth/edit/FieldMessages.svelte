<script module lang="ts">
	/** The ids of the messages a field renders, for its control's aria-describedby. */
	export function describedBy(id: string, hint?: string, error?: string | null) {
		const ids = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean);
		return ids.length ? ids.join(' ') : undefined;
	}
</script>

<script lang="ts">
	let { id, hint, error }: { id: string; hint?: string; error?: string | null } = $props();
</script>

{#if hint}
	<span class="field-hint" id="{id}-hint">{hint}</span>
{/if}
{#if error}
	<span class="field-alert" id="{id}-error" role="alert">{error}</span>
{/if}

<style>
	/* the shared .field-hint look, tucked under the control it explains */
	.field-hint,
	.field-alert {
		display: block;
		margin: 6px 0 0;
	}

	.field-alert {
		font-size: var(--h-type-small);
		color: var(--h-bad-text);
	}
</style>
