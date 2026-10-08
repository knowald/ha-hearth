import { describe, expect, it } from 'vitest';
import { requiredAccess } from './access';

describe('requiredAccess', () => {
	it('leaves pages and reads open', () => {
		expect(requiredAccess('/', 'GET')).toBeUndefined();
		expect(requiredAccess('/_api/custom_css', 'GET')).toBeUndefined();
		expect(requiredAccess('/_api/get_translation', 'POST')).toBeUndefined();
		expect(requiredAccess(null, 'POST')).toBeUndefined();
	});

	it('needs a token for every other write, including endpoints it does not list', () => {
		expect(requiredAccess('/_api/save_hearth', 'POST')).toBe('user');
		expect(requiredAccess('/_api/hearth_images', 'DELETE')).toBe('user');
		expect(requiredAccess('/_api/mcp', 'POST')).toBe('user');
		expect(requiredAccess('/_api/something_new', 'PUT')).toBe('user');
	});

	it('needs an administrator for settings, custom CSS and reloading the screens', () => {
		expect(requiredAccess('/_api/save_config', 'POST')).toBe('admin');
		expect(requiredAccess('/_api/custom_css', 'POST')).toBe('admin');
		expect(requiredAccess('/_api/agent/settings', 'PATCH')).toBe('admin');
		expect(requiredAccess('/_api/agent/css', 'PUT')).toBe('admin');
		expect(requiredAccess('/_api/agent/refresh', 'POST')).toBe('admin');
	});

	it('needs a token for agent reads too', () => {
		expect(requiredAccess('/_api/agent/settings', 'GET')).toBe('user');
	});
});
