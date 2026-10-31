export type ClockHourFormat = 'auto' | '12' | '24';

/** Returns an IANA time-zone name only when Intl can actually format it. */
export function validTimeZone(value?: string): string | undefined {
	const candidate = value?.trim();
	if (!candidate) return undefined;
	try {
		new Intl.DateTimeFormat('en', { timeZone: candidate }).format();
		return candidate;
	} catch {
		return undefined;
	}
}

export function clockTimeOptions(
	timeZone: string | undefined,
	hourFormat: ClockHourFormat = 'auto',
	showSeconds = false
): Intl.DateTimeFormatOptions {
	return {
		hour: '2-digit',
		minute: '2-digit',
		...(showSeconds ? { second: '2-digit' as const } : {}),
		...(hourFormat === '12' ? { hour12: true } : hourFormat === '24' ? { hour12: false } : {}),
		...(timeZone ? { timeZone } : {})
	};
}

export interface ClockReading {
	/** The time without its day period: "5:09" for 5:09 PM, "17:09" in 24-hour time. */
	digits: string;
	/** AM, PM or the locale's word for them; absent in 24-hour time. */
	period?: string;
	/** Some locales (Korean, Chinese, Japanese) put the period before the hour. */
	periodFirst: boolean;
}

/** Splits a formatted time so the day period can be set apart from the digits. */
export function clockReading(
	date: Date,
	locale: string,
	options: Intl.DateTimeFormatOptions
): ClockReading {
	const parts = new Intl.DateTimeFormat(locale, options).formatToParts(date);
	const periodIndex = parts.findIndex((part) => part.type === 'dayPeriod');
	if (periodIndex === -1) {
		return { digits: parts.map((part) => part.value).join(''), periodFirst: false };
	}
	const firstDigit = parts.findIndex(
		(part) => part.type !== 'dayPeriod' && part.type !== 'literal'
	);
	const digits = parts
		.filter((part) => part.type !== 'dayPeriod')
		// a 12-hour clock reads 5:09, not 05:09
		.map((part) => (part.type === 'hour' ? part.value.replace(/^0(?=\d)/, '') : part.value))
		.join('')
		.trim();
	return { digits, period: parts[periodIndex].value, periodFirst: periodIndex < firstDigit };
}

export function hourInTimeZone(date: Date, locale: string, timeZone?: string): number {
	const part = new Intl.DateTimeFormat(locale, {
		hour: 'numeric',
		hourCycle: 'h23',
		...(timeZone ? { timeZone } : {})
	})
		.formatToParts(date)
		.find(({ type }) => type === 'hour')?.value;
	return part === undefined ? date.getHours() : Number(part);
}
