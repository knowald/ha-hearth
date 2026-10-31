import { describe, expect, it } from 'vitest';
import { clockReading, clockTimeOptions, hourInTimeZone, validTimeZone } from './clock';

describe('Hearth rail clock', () => {
	it('accepts IANA time zones and rejects city labels', () => {
		expect(validTimeZone(' Europe/Warsaw ')).toBe('Europe/Warsaw');
		expect(validTimeZone('Warsaw')).toBeUndefined();
	});

	it('builds explicit hour and seconds preferences', () => {
		expect(clockTimeOptions('Europe/Warsaw', '24', true)).toMatchObject({
			timeZone: 'Europe/Warsaw',
			hour12: false,
			second: '2-digit'
		});
	});

	it('sets the day period apart from the digits in 12-hour time', () => {
		const evening = new Date('2026-10-31T17:09:00Z');
		const options = clockTimeOptions('UTC', '12');
		expect(clockReading(evening, 'en', options)).toEqual({
			digits: '5:09',
			period: 'PM',
			periodFirst: false
		});
		expect(clockReading(evening, 'ko', options)).toMatchObject({
			digits: '5:09',
			periodFirst: true
		});
	});

	it('keeps 24-hour time whole', () => {
		const evening = new Date('2026-10-31T17:09:00Z');
		expect(clockReading(evening, 'en', clockTimeOptions('UTC', '24'))).toEqual({
			digits: '17:09',
			periodFirst: false
		});
		const morning = new Date('2026-10-31T07:09:00Z');
		expect(clockReading(morning, 'en', clockTimeOptions('UTC', '24')).digits).toBe('07:09');
	});

	it('uses the configured time zone for greeting time', () => {
		const instant = new Date('2026-01-01T12:00:00Z');
		expect(hourInTimeZone(instant, 'en', 'America/New_York')).toBe(7);
		expect(hourInTimeZone(instant, 'en', 'Asia/Tokyo')).toBe(21);
	});
});
