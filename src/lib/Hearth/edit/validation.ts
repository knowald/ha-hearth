import { fill } from '$lib/core/i18n';

export interface Validity {
	valid: boolean;
	/** Shown beside the disabled Done, so a blocked form says what it needs. */
	reason?: string;
}

/**
 * Done's verdict for a form with required fields: blocked while any is blank,
 * naming the first blank one. `template` is the translated copy with a
 * {field} placeholder.
 */
export function requireFields(
	template: string,
	...fields: { label: string; value: string | undefined }[]
): Validity {
	const missing = fields.find((field) => !field.value?.trim());
	return missing
		? { valid: false, reason: fill(template, { field: missing.label }) }
		: { valid: true };
}
