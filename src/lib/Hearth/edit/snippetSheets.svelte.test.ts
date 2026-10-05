import { fireEvent, render, screen } from '@testing-library/svelte';
import { EditorView } from '@codemirror/view';
import * as yaml from 'js-yaml';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { english as en } from '$lib/core/i18n/testing';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig } from '../config';
import {
	copyState,
	editor,
	hearthConfig,
	requestedConfirmation,
	dismissConfirmation
} from '../store';
import CardEditSheet from './CardEditSheet.svelte';
import RailWidgetEditSheet from './RailWidgetEditSheet.svelte';
import ThemeEditSheet from './ThemeEditSheet.svelte';

function seed() {
	const config: HearthConfig = structuredClone(DEFAULT_HEARTH_CONFIG);
	config.rooms = [
		{
			id: 'den',
			name: 'Den',
			icon: 'sofa',
			cards: [
				[
					{
						id: 'readings',
						type: 'entities',
						title: 'Readings',
						entities: [{ entity: 'sensor.co2' }]
					}
				] as never
			]
		}
	];
	config.rail = [{ id: 'clock', type: 'clock' }] as never;
	hearthConfig.set(config);
}

const cards = () => get(hearthConfig).rooms[0].cards![0];

// CodeField loads the editor on demand: settle that import and the render it unblocks
async function codeView(container: HTMLElement) {
	await vi.dynamicImportSettled();
	await tick();
	const element = container.ownerDocument.querySelector('.cm-editor');
	expect(element).toBeTruthy();
	return EditorView.findFromDOM(element as HTMLElement)!;
}

async function typeInto(view: EditorView, text: string) {
	view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
	await tick();
}

const yamlIssue = (container: HTMLElement) =>
	container.ownerDocument.querySelector('.field-error[aria-live]')?.textContent ?? '';
const snippetIssue = (container: HTMLElement) =>
	container.ownerDocument.querySelector('.snippet-input .issue')?.textContent ?? '';

const done = () => screen.getByRole('button', { name: en.done }) as HTMLButtonElement;
const formButton = () => screen.getByRole('button', { name: en.hearth_form }) as HTMLButtonElement;

describe('the YAML tab', () => {
	beforeEach(seed);
	afterEach(() => {
		editor.set(null);
		dismissConfirmation();
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('shows the card as saved and applies an option the form has no field for', async () => {
		const { container } = render(CardEditSheet, { roomId: 'den', id: 'readings' });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_yaml }));
		const view = await codeView(container);
		const shown = yaml.load(view.state.doc.toString()) as Record<string, unknown>;
		expect(shown).toMatchObject({ id: 'readings', type: 'entities', title: 'Readings' });

		await typeInto(
			view,
			'id: readings\ntype: entities\ntitle: Readings\nentities:\n  - entity: sensor.co2\n    verdict: {good: 800, fair: 1200}\n'
		);
		expect(done().disabled).toBe(false);
		await fireEvent.click(done());
		expect(cards()[0]).toMatchObject({
			id: 'readings',
			entities: [{ entity: 'sensor.co2', verdict: { good: 800, fair: 1200 } }]
		});
	});

	it('blocks Done and the way back to the form while the YAML is wrong', async () => {
		const { container } = render(CardEditSheet, { roomId: 'den', id: 'readings' });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_yaml }));
		await typeInto(await codeView(container), 'id: readings\ntype: entities\nentities: [\n');
		expect(done().disabled).toBe(true);
		expect(screen.getByText(en.hearth_fix_the_yaml)).toBeTruthy();
		expect(yamlIssue(container)).toMatch(/^Line \d+: /);
		expect(formButton().disabled).toBe(true);

		// the unapplied text counts as a change, so closing asks first
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(get(requestedConfirmation)?.confirmLabel).toBe(en.hearth_discard);
	});

	it('reads the YAML back into the form, keeping what only YAML sets', async () => {
		const { container } = render(CardEditSheet, { roomId: 'den', id: 'readings' });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_yaml }));
		await typeInto(
			await codeView(container),
			'type: entities\ntitle: Air\nentities:\n  - entity: sensor.co2\n    verdict: false\n'
		);
		expect(formButton().disabled).toBe(false);
		await fireEvent.click(formButton());
		// the type's editor remounts on the YAML's card and loads on demand
		await vi.dynamicImportSettled();
		await tick();
		expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Air');
		await fireEvent.click(done());
		expect(cards()[0]).toMatchObject({
			id: 'readings',
			title: 'Air',
			entities: [{ entity: 'sensor.co2', verdict: false }]
		});
	});

	it('edits a widget the same way', async () => {
		const { container } = render(RailWidgetEditSheet, { index: 0 });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_yaml }));
		await typeInto(await codeView(container), 'id: clock\ntype: clock\nshow_seconds: true\n');
		expect(done().disabled).toBe(false);
		await fireEvent.click(done());
		expect(get(hearthConfig).rail[0]).toMatchObject({ id: 'clock', show_seconds: true });
	});

	it('refuses aliases and merge keys by name', async () => {
		const { container } = render(CardEditSheet, { roomId: 'den', id: 'readings' });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_yaml }));
		const view = await codeView(container);
		await typeInto(view, 'type: entities\ntitle: &t Air\nicon: *t\n');
		expect(yamlIssue(container)).toContain('aliases (*name) are not supported');
		await typeInto(view, 'type: entities\n<<: {title: Air}\n');
		expect(yamlIssue(container)).toBe(
			'Line 2: YAML merge keys (<<) are not supported, write the keys out'
		);
		expect(done().disabled).toBe(true);
	});

	it('drops a staged widget move when the YAML sends it to the other side', async () => {
		hearthConfig.update((config) => ({
			...config,
			rail_position: 'both',
			rail: [
				{ id: 'clock', type: 'clock' },
				{ id: 'status', type: 'status' },
				{ id: 'label', type: 'label', side: 'right' }
			] as never
		}));
		const { container } = render(RailWidgetEditSheet, { index: 1 });
		await fireEvent.click(screen.getByTitle(en.hearth_move_up));
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_yaml }));
		await typeInto(await codeView(container), 'id: status\ntype: status\nside: right\n');
		await fireEvent.click(formButton());
		await fireEvent.click(done());
		expect(get(hearthConfig).rail.map((widget) => widget.id)).toEqual(['clock', 'label', 'status']);
	});
});

describe('Copy as YAML', () => {
	beforeEach(seed);
	afterEach(() => {
		vi.unstubAllGlobals();
		editor.set(null);
		copyState.set('idle');
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('puts the card on the clipboard', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
		render(CardEditSheet, { roomId: 'den', id: 'readings' });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_copy_as_yaml }));
		await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
		expect(yaml.load(writeText.mock.calls[0][0])).toMatchObject({
			id: 'readings',
			type: 'entities'
		});
		expect(get(copyState)).toBe('copied');
	});

	it('waits for a form the sheet cannot save', () => {
		hearthConfig.update((config) => ({
			...config,
			rail: [{ id: 'timer', type: 'timer' }] as never
		}));
		render(RailWidgetEditSheet, { index: 0 });
		return vi.waitFor(() =>
			expect(
				(screen.getByRole('button', { name: en.hearth_copy_as_yaml }) as HTMLButtonElement).disabled
			).toBe(true)
		);
	});

	it('shows the text selected for copying by hand without a clipboard', async () => {
		vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
		render(RailWidgetEditSheet, { index: 0 });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_copy_as_yaml }));
		const area = (await screen.findByLabelText(en.hearth_yaml_to_copy)) as HTMLTextAreaElement;
		expect(area.value).toBe('id: clock\ntype: clock\n');
		expect(area.selectionEnd - area.selectionStart).toBe(area.value.length);
		expect(get(copyState)).toBe('idle');
	});
});

describe('Paste YAML', () => {
	beforeEach(seed);
	afterEach(() => {
		editor.set(null);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	async function paste(text: string) {
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_paste_yaml }));
		await fireEvent.input(screen.getByLabelText(en.hearth_yaml_to_add), {
			target: { value: text }
		});
		await fireEvent.click(screen.getByRole('button', { name: en.add }));
	}

	it('adds pasted cards to the column with ids of their own', async () => {
		editor.set({ kind: 'card', roomId: 'den', id: null, column: 0 });
		render(CardEditSheet, { roomId: 'den', id: null, column: 0 });
		await paste(
			'- id: readings\n  type: entities\n  title: Copy\n- type: iframe\n  url: about:blank\n'
		);
		expect(cards().map((card) => card.id)).toEqual(['readings', 'entities', 'iframe']);
		expect(cards()[1]).toMatchObject({ title: 'Copy' });
		expect(get(editor)).toBeNull();
	});

	it('says why a paste cannot be added as it arrives, and adds nothing', async () => {
		const { container } = render(CardEditSheet, { roomId: 'den', id: null, column: 0 });
		await paste('type: picture-glance\n');
		expect(snippetIssue(container)).toBe('Line 1: type is not a supported card type');
		expect((screen.getByRole('button', { name: en.add }) as HTMLButtonElement).disabled).toBe(true);
		expect(cards()).toHaveLength(1);
	});

	it('fills the box from the clipboard and adds on Add', async () => {
		vi.stubGlobal('navigator', {
			...navigator,
			clipboard: { readText: vi.fn().mockResolvedValue('type: iframe\nurl: about:blank\n') }
		});
		render(CardEditSheet, { roomId: 'den', id: null, column: 0 });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_paste_yaml }));
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_paste_from_clipboard }));
		await vi.waitFor(() =>
			expect((screen.getByLabelText(en.hearth_yaml_to_add) as HTMLTextAreaElement).value).toContain(
				'type: iframe'
			)
		);
		expect(cards()).toHaveLength(1);
		await fireEvent.click(screen.getByRole('button', { name: en.add }));
		expect(cards().map((card) => card.id)).toEqual(['readings', 'iframe']);
		vi.unstubAllGlobals();
	});

	it('adds a pasted widget to the rail', async () => {
		render(RailWidgetEditSheet, { index: null });
		await paste('id: clock\ntype: clock\n');
		expect(get(hearthConfig).rail.map((widget) => widget.id)).toEqual(['clock', 'clock-2']);
	});
});

describe('theme sharing', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
		hearthConfig.set(structuredClone({ ...DEFAULT_HEARTH_CONFIG, theme: { accent: '#ff8800' } }));
		editor.set({ kind: 'theme' });
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		editor.set(null);
		copyState.set('idle');
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('copies the theme as YAML', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
		render(ThemeEditSheet);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_copy_as_yaml }));
		await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
		expect(yaml.load(writeText.mock.calls[0][0])).toEqual({
			name: en.day,
			theme: { accent: '#ff8800' }
		});
	});

	it('previews an import and applies it as one step', async () => {
		const { container } = render(ThemeEditSheet);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_import }));
		const box = screen.getByLabelText(en.hearth_theme_yaml);
		const apply = screen.getByRole('button', { name: en.hearth_apply }) as HTMLButtonElement;

		await fireEvent.input(box, { target: { value: 'theme:\n  accent: 12\n' } });
		expect(apply.disabled).toBe(true);
		expect(snippetIssue(container)).toBe('Line 2: accent must be text');

		await fireEvent.input(box, {
			target: { value: 'name: Moss\ntheme:\n  accent: "#3a7d44"\n  cool: "#4a90a4"\n' }
		});
		expect(screen.getByText('Moss')).toBeTruthy();
		expect(screen.getByText('2 tokens')).toBeTruthy();
		expect(get(hearthConfig).theme).toEqual({ accent: '#ff8800' });
		await fireEvent.click(apply);
		expect(get(hearthConfig).theme).toEqual({ accent: '#3a7d44', cool: '#4a90a4' });
	});

	it('leaves out keys that are not tokens and says so', async () => {
		render(ThemeEditSheet);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_import }));
		await fireEvent.input(screen.getByLabelText(en.hearth_theme_yaml), {
			target: { value: 'accent: "#3a7d44"\nsparkle: "on"\n' }
		});
		expect(screen.getByText('1 token')).toBeTruthy();
		expect(screen.getByText('Not theme tokens, left out: sparkle')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_apply }));
		expect(get(hearthConfig).theme).toEqual({ accent: '#3a7d44' });
	});

	it.each([
		['accent: "red; display: none"\n', 'Line 1: accent must be a hex colour like #f0b860'],
		[
			'text_1: "#fff /*"\n',
			'Line 1: text_1 must not contain comments, backslashes, braces or angle brackets'
		],
		[
			'background_image: url(https://tracker.example/pixel.png)\n',
			'Line 1: background_image must be none or url() of an uploaded image, a path on this host or a data:image URL'
		]
	])('refuses to import %s', async (text, issue) => {
		const { container } = render(ThemeEditSheet);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_import }));
		await fireEvent.input(screen.getByLabelText(en.hearth_theme_yaml), {
			target: { value: text }
		});
		expect(snippetIssue(container)).toBe(issue);
		expect(
			(screen.getByRole('button', { name: en.hearth_apply }) as HTMLButtonElement).disabled
		).toBe(true);
	});
});
