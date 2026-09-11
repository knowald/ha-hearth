import { writable } from 'svelte/store';
import * as v from 'valibot';

/* App-wide settings from data/configuration.yaml, for Hearth. */

export type SliderUpdateMode = 'continuous' | 'release';

export const ConfigurationSchema = v.object({
	locale: v.optional(v.pipe(v.string(), v.regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i))),
	custom_js: v.optional(v.boolean()),
	motion: v.optional(v.boolean()),
	token: v.optional(v.string()),
	revision: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)))
});

export type Configuration = v.InferOutput<typeof ConfigurationSchema> & { hassUrl?: string };

export interface PersistentNotification {
	created_at: string;
	message: string;
	notification_id: string;
	title: string;
	status: 'read' | 'unread';
}

export const configuration = writable<Configuration>();
