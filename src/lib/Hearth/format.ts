import { isRecord } from './normalizers';

/** First standalone document format. Earlier experimental formats are unsupported. */
export const CONFIG_VERSION = 5;

export function configVersion(raw: unknown): number | undefined {
	return isRecord(raw) && Number.isInteger(raw.version) ? (raw.version as number) : undefined;
}

/** Editor drafts omit the server-owned version; persisted files must declare it. */
export function currentHearthConfig(raw: unknown): unknown {
	if (!isRecord(raw)) return raw;
	if (raw.version !== undefined && raw.version !== CONFIG_VERSION) {
		throw new Error(
			`Unsupported Hearth configuration version ${String(raw.version)}; expected ${CONFIG_VERSION}`
		);
	}
	return raw;
}
