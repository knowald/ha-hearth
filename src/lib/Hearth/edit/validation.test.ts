import { describe, expect, it } from 'vitest';
import { requireFields } from './validation';

describe('requireFields', () => {
	it('blocks while a field is blank and names the first blank one', () => {
		expect(
			requireFields(
				'{field} is required',
				{ label: 'Entity', value: 'climate.living' },
				{ label: 'Name', value: '  ' },
				{ label: 'Icon', value: undefined }
			)
		).toEqual({ valid: false, reason: 'Name is required' });
	});

	it('passes once every field has a value', () => {
		expect(requireFields('{field} is required', { label: 'Entity', value: 'camera.door' })).toEqual(
			{ valid: true }
		);
	});
});
