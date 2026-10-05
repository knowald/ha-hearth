import * as v from 'valibot';
import type { StatisticRow } from '$lib/core/ha/history';
import type { RailWidget } from '../../types';
import type { WidgetDefinition } from '../types';
import { OptionalFlag, OptionalText, OptionalEntityId, optionalNumberAtLeast } from '../../schema';
import { trimmedOrUndefined } from '../../normalizers';

export type EnergyWidget = Extract<RailWidget, { type: 'energy' }>;

export const energyWidget: WidgetDefinition<EnergyWidget> = {
	type: 'energy',
	label: 'hearth_widget_energy_label',
	name: 'hearth_widget_energy_name',
	sub: 'hearth_widget_energy_sub',
	icon: 'bolt',
	normalize: (widget) => ({
		entity: trimmedOrUndefined(widget.entity),
		price:
			typeof widget.price === 'number' && Number.isFinite(widget.price) && widget.price >= 0
				? widget.price
				: undefined,
		price_entity: trimmedOrUndefined(widget.price_entity),
		currency: trimmedOrUndefined(widget.currency),
		average_badge: widget.average_badge === false ? false : undefined
	}),
	schema: v.looseObject({
		entity: OptionalEntityId,
		price: optionalNumberAtLeast(0),
		price_entity: OptionalEntityId,
		currency: OptionalText,
		average_badge: OptionalFlag
	}),
	needsConfiguration: (widget) => !widget.entity,
	entityIds: (widget) => [widget.entity, widget.price_entity].filter((id): id is string => !!id)
};

/**
 * kWh per statistic row, oldest first. Energy statistics carry the change per
 * period; without it the change comes from consecutive sums, and the first
 * row, which has nothing to subtract, counts as 0.
 */
export function usagePerRow(rows: StatisticRow[]): number[] {
	let previousSum: number | undefined;
	return rows.map((row) => {
		let value = row.change;
		if (typeof value !== 'number' && typeof row.sum === 'number') {
			value = previousSum === undefined ? 0 : row.sum - previousSum;
		}
		if (typeof row.sum === 'number') previousSum = row.sum;
		return Math.max(0, value ?? 0);
	});
}
