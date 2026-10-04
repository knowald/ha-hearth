import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { OverviewCard, OverviewItem } from './config';
import { hearthEditMode } from './store';
import CardColumns from './CardColumns.svelte';

function card(id: string, span?: OverviewCard['span']): OverviewCard {
	return {
		id,
		type: 'iframe',
		url: 'https://example.com',
		...(span ? { span } : {})
	} as OverviewCard;
}

function renderColumns(columns: OverviewItem[][]) {
	return render(CardColumns, {
		columns,
		locate: () => columns,
		groupName: 'test-cards',
		roomId: 'home'
	});
}

const slot = (container: HTMLElement, id: string) =>
	container.querySelector<HTMLElement>(`.card-slot[data-id="${id}"]`)!;

describe('CardColumns spans', () => {
	afterEach(() => hearthEditMode.set(false));

	it('gives a full-width card a row across both columns', () => {
		const { container } = renderColumns([
			[card('a'), card('wide', 'full'), card('b')],
			[card('c')]
		]);
		const overview = container.querySelector<HTMLElement>('.overview')!;
		expect(overview.classList.contains('spanned')).toBe(true);
		expect(overview.style.getPropertyValue('--span-rows')).toBe('auto auto auto');

		const wide = slot(container, 'wide').parentElement!;
		expect(wide.classList.contains('span-cell')).toBe(true);
		expect(wide.style.getPropertyValue('--row')).toBe('2');
		expect(wide.style.getPropertyValue('--start')).toBe('1');
		expect(wide.style.getPropertyValue('--span')).toBe('2');

		const below = slot(container, 'b').parentElement!;
		expect(below.classList.contains('column')).toBe(true);
		expect(below.style.getPropertyValue('--row')).toBe('3');
		// folded, the card reads between a and b, where it is stored
		expect(wide.style.getPropertyValue('--order')).toBe('1');
		expect(below.style.getPropertyValue('--order')).toBe('2');
		expect(slot(container, 'c').parentElement!.style.getPropertyValue('--order')).toBe('3');
	});

	it('ignores spans on a single column', () => {
		const { container } = renderColumns([[card('a'), card('wide', 'full')]]);
		expect(container.querySelector('.overview.spanned')).toBeNull();
		expect(container.querySelectorAll('.column')).toHaveLength(1);
	});

	it('keeps a spanning card in its own column while editing, so it can be dragged', () => {
		hearthEditMode.set(true);
		const { container } = renderColumns([[card('a'), card('wide', 'full')], [card('c')]]);
		expect(container.querySelector('.overview.spanned')).toBeNull();
		expect(slot(container, 'wide').parentElement!.classList.contains('column')).toBe(true);
	});
});
