<script module lang="ts">
	/** The ids of the messages a field renders, for its control's aria-describedby. */
	export function describedBy(
		id: string,
		hint?: string,
		error?: string | null,
		warning?: string | null
	) {
		const ids = [hint && `${id}-hint`, error && `${id}-error`, warning && `${id}-warning`].filter(
			Boolean
		);
		return ids.length ? ids.join(' ') : undefined;
	}
</script>

<script lang="ts">
	let {
		id,
		hint,
		error,
		warning
	}: {
		id: string;
		hint?: string;
		error?: string | null;
		/** Worth a second look but not blocking, such as an entity Home Assistant does not report. */
		warning?: string | null;
	} = $props();
</script>

{#if hint}
	<span class="field-hint" id="{id}-hint">{hint}</span>
{/if}
{#if error}
	<span class="field-alert" id="{id}-error" role="alert">{error}</span>
{/if}
{#if warning}
	<span class="field-warning" id="{id}-warning">{warning}</span>
{/if}

<style>
	/* the shared .field-hint look, tucked under the control it explains */
	.field-hint,
	.field-alert,
	.field-warning {
		display: block;
		margin: 6px 0 0;
	}

	.field-alert,
	.field-warning {
		font-size: var(--h-type-small);
	}

	.field-alert {
		color: var(--h-bad-text);
	}

	/* the same amber as a warning alert */
	.field-warning {
		color: var(--h-accent-text);
	}
</style>
