import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConnection, type Connection } from 'home-assistant-js-websocket';
import {
	authentication,
	connected,
	connection,
	health,
	startConnection,
	stopConnection
} from './connection';

vi.mock('home-assistant-js-websocket', async (importOriginal) => ({
	...(await importOriginal<typeof import('home-assistant-js-websocket')>()),
	createConnection: vi.fn(),
	subscribeEntities: vi.fn(),
	subscribeConfig: vi.fn(),
	subscribeServices: vi.fn()
}));

afterEach(() => {
	stopConnection();
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe('authentication', () => {
	it('keeps the caller retrying when the Home Assistant URL is missing', async () => {
		health.set('connected');
		await expect(authentication({})).rejects.toThrow('Home Assistant URL is not configured');
		expect(get(health)).toBe('lost');
		expect(get(connected)).toBe(false);
	});

	it('keeps a successful socket alive until its owner stops it', async () => {
		vi.useFakeTimers();
		const close = vi.fn();
		const socket = {
			close,
			addEventListener: vi.fn(),
			subscribeMessage: vi.fn(async () => async () => {})
		} as unknown as Connection;
		vi.mocked(createConnection).mockResolvedValue(socket);
		startConnection({ hassUrl: 'http://localhost:8123', token: 'test' });
		await vi.advanceTimersByTimeAsync(10_000);
		expect(createConnection).toHaveBeenCalledOnce();
		expect(get(connection)).toBe(socket);
		expect(close).not.toHaveBeenCalled();
		stopConnection();
		expect(close).toHaveBeenCalledOnce();
		expect(get(connection)).toBeUndefined();
		expect(get(connected)).toBe(false);
	});
});
