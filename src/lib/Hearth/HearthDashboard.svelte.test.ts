import { act, fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { english as en } from '$lib/core/i18n/testing';
import { states } from '$lib/core/ha/entities';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig } from './config';
import {
	cancelEdit,
	currentRoom,
	enterEditMode,
	hearthConfig,
	hearthEditMode,
	hearthLoadError,
	hearthNeedsSetup,
	setupWizardOpen
} from './store';
import HearthDashboard from './HearthDashboard.svelte';

vi.mock('$lib/core/ha/registry', () => ({ fetchRegistry: vi.fn(() => new Promise(() => {})) }));

function stubBrowser() {
	vi.stubGlobal('matchMedia', () => ({
		matches: false,
		addEventListener() {},
		removeEventListener() {}
	}));
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe() {}
			disconnect() {}
		}
	);
	Element.prototype.scrollTo ??= () => {};
	Element.prototype.animate ??= () =>
		({ cancel() {}, finished: Promise.resolve() }) as unknown as Animation;
}

describe('HearthDashboard first run', () => {
	beforeEach(stubBrowser);
	afterEach(() => {
		hearthNeedsSetup.set(false);
		hearthLoadError.set(null);
		setupWizardOpen.set(false);
		vi.unstubAllGlobals();
	});

	it('keeps a way back to the area import on the home page after the wizard is skipped', async () => {
		// the wizard loads on demand; compiling the chunk here, outside the
		// findBy timeout, keeps a cold transform under a loaded suite from
		// failing the test
		await import('./SetupWizard.svelte');
		hearthNeedsSetup.set(true);
		render(HearthDashboard);
		expect(get(setupWizardOpen)).toBe(true);
		await fireEvent.click(await screen.findByRole('button', { name: en.hearth_skip_for_now }));
		expect(get(setupWizardOpen)).toBe(false);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_setup }));
		expect(get(setupWizardOpen)).toBe(true);
	});

	it('offers no import prompt once the dashboard has content', () => {
		render(HearthDashboard);
		expect(screen.queryByText(en.hearth_setup_prompt)).toBeNull();
	});
});

describe('HearthDashboard navigation', () => {
	const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

	function withRooms(rail: HearthConfig['rail']): HearthConfig {
		return {
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			rail,
			rooms: [
				{ id: 'home', name: 'Home', icon: 'home', cards: [[]] },
				{ id: 'kitchen', name: 'Kitchen', icon: 'kitchen', cards: [[]] }
			]
		};
	}

	beforeEach(() => {
		stubBrowser();
		states.set({});
	});

	afterEach(async () => {
		if (get(hearthEditMode)) cancelEdit();
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		currentRoom.set('home');
		history.replaceState(null, '', '/');
		vi.unstubAllGlobals();
		await settle();
	});

	it('never opens search from the rail while editing', async () => {
		hearthConfig.set(withRooms([{ id: 'search', type: 'search' }]));
		render(HearthDashboard);
		await act(() => enterEditMode());
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_search_placeholder }));
		expect(screen.queryByRole('dialog', { name: en.search })).toBeNull();
	});

	it('builds the page list into a wide rail that has no visible nav widget', async () => {
		hearthConfig.set(withRooms([{ id: 'clock', type: 'clock' }]));
		const { container } = render(HearthDashboard);
		expect(container.querySelectorAll('.rail-scroll .nav-item')).toHaveLength(2);

		hearthConfig.set(
			withRooms([{ id: 'nav', type: 'nav', visibility: [{ entity: 'input_boolean.guests' }] }])
		);
		await act();
		expect(container.querySelector('[data-widget="built-in-nav"]')).not.toBeNull();
		expect(container.querySelectorAll('.rail-scroll .nav-item')).toHaveLength(2);

		await act(() => states.set({ 'input_boolean.guests': { state: 'on' } } as never));
		// the configured widget is back, so the built-in list steps aside
		expect(container.querySelectorAll('.rail-scroll .nav-item')).toHaveLength(2);
		expect(container.querySelector('[data-widget="built-in-nav"]')).toBeNull();
	});

	it('brings the built-in page list back when a resize hides the nav widget', async () => {
		// a query no other test uses, since mediaQuery caches its stores
		const wide = '(min-width: 1401px)';
		const listeners = new Set<() => void>();
		const list = {
			matches: true,
			addEventListener: (_: string, listener: () => void) => listeners.add(listener),
			removeEventListener: (_: string, listener: () => void) => listeners.delete(listener)
		};
		vi.stubGlobal('matchMedia', (query: string) =>
			query === wide ? list : { matches: false, addEventListener() {}, removeEventListener() {} }
		);
		hearthConfig.set(withRooms([{ id: 'nav', type: 'nav', visibility: [{ media: wide }] }]));
		const { container } = render(HearthDashboard);
		await act();
		expect(container.querySelector('[data-widget="built-in-nav"]')).toBeNull();

		list.matches = false;
		await act(() => listeners.forEach((listener) => listener()));
		expect(container.querySelector('[data-widget="built-in-nav"]')).not.toBeNull();
		expect(container.querySelectorAll('.rail-scroll .nav-item')).toHaveLength(2);
	});

	it('keeps the page in ?room= next to the other parameters and the hash', async () => {
		history.replaceState(null, '', '/?theme=slate&room=kitchen#top');
		hearthConfig.set(withRooms([{ id: 'nav', type: 'nav' }]));
		const { container } = render(HearthDashboard);
		await act();
		expect(get(currentRoom)).toBe('kitchen');

		const home = container.querySelector<HTMLButtonElement>('.rail-scroll [data-id="home"]')!;
		await fireEvent.click(home);
		expect(home.getAttribute('aria-current')).toBe('page');
		const url = new URL(location.href);
		expect(url.searchParams.get('room')).toBe('home');
		expect(url.searchParams.get('theme')).toBe('slate');
		expect(url.hash).toBe('#top');

		// back from an overlay can land on an entry that still names the old page
		history.replaceState(history.state, '', '/?theme=slate&room=kitchen#top');
		window.dispatchEvent(new PopStateEvent('popstate'));
		expect(new URL(location.href).searchParams.get('room')).toBe('home');
	});

	it('leaves a hidden page out of the nav widget and the phone strip, dimmed while editing', async () => {
		const config = withRooms([{ id: 'nav', type: 'nav' }]);
		config.rooms[1].visibility = [{ entity: 'input_boolean.cooking', state: 'on' }];
		hearthConfig.set(config);
		const { container } = render(HearthDashboard);
		await act();
		const pages = () => ({
			rail: [...container.querySelectorAll<HTMLElement>('.rail-scroll .nav-item')].map(
				(node) => node.dataset.id
			),
			strip: [...container.querySelectorAll('.phone-nav .page')].map(
				(node) => node.lastElementChild?.textContent
			)
		});
		expect(pages()).toEqual({ rail: ['home'], strip: ['Home'] });

		await act(() => states.set({ 'input_boolean.cooking': { state: 'on' } } as never));
		expect(pages().rail).toEqual(['home', 'kitchen']);

		await act(() => states.set({}));
		await act(() => enterEditMode());
		const kitchen = container.querySelector('.rail-scroll [data-id="kitchen"]')!;
		expect(kitchen.classList.contains('visibility-dimmed')).toBe(true);
		expect(container.querySelectorAll('.phone-nav .page.visibility-dimmed')).toHaveLength(1);
	});

	it('keeps a page on screen when it becomes hidden there, or when editing ends on it', async () => {
		const config = withRooms([{ id: 'nav', type: 'nav' }]);
		config.rooms[1].visibility = [{ entity: 'input_boolean.cooking', state: 'on' }];
		hearthConfig.set(config);
		states.set({ 'input_boolean.cooking': { state: 'on' } } as never);
		const { container } = render(HearthDashboard);
		await act();
		await fireEvent.click(container.querySelector('.rail-scroll [data-id="kitchen"]')!);
		expect(container.querySelector('[data-page="kitchen"]')).not.toBeNull();

		await act(() => states.set({ 'input_boolean.cooking': { state: 'off' } } as never));
		expect(get(currentRoom)).toBe('kitchen');
		expect(container.querySelector('[data-page="kitchen"]')).not.toBeNull();
		expect(container.querySelector('.rail-scroll [data-id="kitchen"]')).toBeNull();

		await fireEvent.click(container.querySelector('.rail-scroll [data-id="home"]')!);
		expect(container.querySelector('[data-page="home"]')).not.toBeNull();

		// a hidden page picked while editing stays once editing ends
		await act(() => enterEditMode());
		await fireEvent.click(container.querySelector('.rail-scroll [data-id="kitchen"]')!);
		await act(() => cancelEdit());
		expect(get(currentRoom)).toBe('kitchen');
		expect(container.querySelector('[data-page="kitchen"]')).not.toBeNull();
	});

	it('sends a ?room= link to a hidden page to the first page shown', async () => {
		history.replaceState(null, '', '/?room=kitchen');
		const config = withRooms([{ id: 'nav', type: 'nav' }]);
		config.rooms.unshift({
			id: 'night',
			name: 'Night',
			icon: 'bedtime',
			visibility: [{ entity: 'input_boolean.night', state: 'on' }],
			cards: [[]]
		});
		config.rooms[2].visibility = [{ entity: 'input_boolean.cooking', state: 'on' }];
		hearthConfig.set(config);
		render(HearthDashboard);
		await act();
		expect(get(currentRoom)).toBe('home');
		expect(new URL(location.href).searchParams.get('room')).toBe('home');
	});

	it('closes the search overlay on back', async () => {
		hearthConfig.set(withRooms([{ id: 'search', type: 'search' }]));
		render(HearthDashboard);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_search_placeholder }));
		expect(screen.getByRole('dialog', { name: en.search })).toBeTruthy();
		await settle();
		await act(() => window.dispatchEvent(new PopStateEvent('popstate')));
		expect(screen.queryByRole('dialog', { name: en.search })).toBeNull();
	});

	it('restores a ?theme= preset once editing ends', async () => {
		history.replaceState(null, '', '/?theme=slate');
		hearthConfig.set(withRooms([{ id: 'nav', type: 'nav' }]));
		render(HearthDashboard);
		await act();
		// theme tokens are set through the CSSOM, so they show in the rules, not the markup
		const tokens = () =>
			[...document.head.querySelectorAll<HTMLStyleElement>('style[data-hearth-theme]')]
				.map((element) => (element.sheet?.cssRules[0] as CSSStyleRule).style.cssText)
				.join('\n');
		const withPreset = tokens();
		await act(() => enterEditMode());
		expect(tokens()).not.toBe(withPreset);
		await act(() => cancelEdit());
		expect(tokens()).toBe(withPreset);
	});
});
