import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callService } from 'home-assistant-js-websocket';
import type { Connection } from 'home-assistant-js-websocket';
import { connection, health } from './connection';
import { runAction, setCommandGate, type ActionHost, type HaAction } from './commands';

vi.mock('home-assistant-js-websocket', async (importOriginal) => ({
	...(await importOriginal<typeof import('home-assistant-js-websocket')>()),
	callService: vi.fn(() => Promise.resolve())
}));

function host() {
	return {
		entity: 'switch.fan',
		fallback: vi.fn(),
		toggle: vi.fn(),
		moreInfo: vi.fn(),
		navigate: vi.fn(),
		// runs at once, as if the user agreed
		confirm: vi.fn((_text: string | undefined, run: () => void) => run())
	} satisfies ActionHost;
}

beforeEach(() => {
	connection.set({} as Connection);
	health.set('connected');
});

afterEach(() => {
	vi.clearAllMocks();
	setCommandGate(() => true);
	connection.set(undefined as unknown as Connection);
	health.set('lost');
});

describe('runAction', () => {
	it('runs the fallback without an action and for default', () => {
		for (const action of [undefined, { action: 'default' } as HaAction]) {
			const surface = host();
			runAction(action, surface);
			expect(surface.fallback).toHaveBeenCalledOnce();
		}
	});

	it('does nothing for none', () => {
		const surface = host();
		runAction({ action: 'none' }, surface);
		for (const handler of [surface.fallback, surface.toggle, surface.moreInfo, surface.navigate])
			expect(handler).not.toHaveBeenCalled();
		expect(callService).not.toHaveBeenCalled();
	});

	it('toggles and opens the surface entity unless the action names another', () => {
		const surface = host();
		runAction({ action: 'toggle' }, surface);
		runAction({ action: 'more-info', entity: 'sensor.power' }, surface);
		expect(surface.toggle).toHaveBeenCalledWith('switch.fan');
		expect(surface.moreInfo).toHaveBeenCalledWith('sensor.power');
	});

	it('calls the service with its target and data', () => {
		runAction(
			{
				action: 'perform-action',
				perform_action: 'script.turn_on',
				target: { entity_id: 'script.goodnight' },
				data: { variables: { dim: true } }
			},
			host()
		);
		expect(callService).toHaveBeenCalledWith(
			{},
			'script',
			'turn_on',
			{ variables: { dim: true } },
			{ entity_id: 'script.goodnight' }
		);
	});

	it('hands navigate to the host and opens a URL in a new tab', () => {
		const open = vi.spyOn(window, 'open').mockReturnValue(null);
		const surface = host();
		runAction({ action: 'navigate', navigation_path: 'kitchen' }, surface);
		runAction({ action: 'url', url_path: 'https://example.com' }, surface);
		expect(surface.navigate).toHaveBeenCalledWith('kitchen');
		expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener');
		open.mockRestore();
	});

	it('asks first when the action wants confirmation, with the configured question', () => {
		const surface = host();
		surface.confirm.mockImplementation(() => {});
		runAction({ action: 'toggle', confirmation: { text: 'Really?' } }, surface);
		expect(surface.confirm).toHaveBeenCalledWith('Really?', expect.any(Function));
		expect(surface.toggle).not.toHaveBeenCalled();

		surface.confirm.mock.calls[0][1]();
		expect(surface.toggle).toHaveBeenCalledWith('switch.fan');

		runAction({ action: 'navigate', navigation_path: 'a', confirmation: true }, surface);
		expect(surface.confirm).toHaveBeenLastCalledWith(undefined, expect.any(Function));
	});

	it('refuses device commands while the gate is closed, without asking first', () => {
		setCommandGate(() => false);
		const surface = host();
		runAction({ action: 'toggle', confirmation: true }, surface);
		runAction({ action: 'perform-action', perform_action: 'scene.turn_on' }, surface);
		expect(surface.confirm).not.toHaveBeenCalled();
		expect(surface.toggle).not.toHaveBeenCalled();
		expect(callService).not.toHaveBeenCalled();
		// leaving a page is not a device command
		runAction({ action: 'navigate', navigation_path: 'a' }, surface);
		expect(surface.navigate).toHaveBeenCalledOnce();
	});
});
