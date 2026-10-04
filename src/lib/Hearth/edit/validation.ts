import { fill } from '$lib/core/i18n';

export interface Validity {
	valid: boolean;
	/** Shown beside the disabled Done, so a blocked form says what it needs. */
	reason?: string;
}

/**
 * Done's verdict for a form with required fields: blocked while any is blank,
 * naming the first blank one. `template` is the translated copy with a
 * {field} placeholder; a field whose label reads badly in it (long, or plural)
 * brings its own `reason`.
 */
export function requireFields(
	template: string,
	...fields: { label: string; value: string | undefined; reason?: string }[]
): Validity {
	const missing = fields.find((field) => !field.value?.trim());
	if (!missing) return { valid: true };
	return { valid: false, reason: missing.reason ?? fill(template, { field: missing.label }) };
}
