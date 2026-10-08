import { version } from '../../../package.json';
import {
	listVersions,
	prepareDashboard,
	readCustomCss,
	readDashboard,
	readSettings,
	readVersion,
	refreshScreens,
	saveCustomCss,
	saveDashboard,
	updateSettings,
	type SaveOutcome
} from './documents';
import { checkToken } from './auth';
import { outlineJsonSchema, typeJsonSchema } from './schema';

/*
 * A Model Context Protocol server over Streamable HTTP, stateless and with
 * plain JSON responses: every POST carries one JSON-RPC message (or a batch)
 * and gets its answer in the response body. Hearth sends no requests or
 * notifications of its own, so it needs no SSE stream or session.
 */

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
// every message in a batch may run a tool, so one request cannot ask for many
const MAX_BATCH = 20;

const INSTRUCTIONS = `Hearth is a Home Assistant dashboard. Its layout lives in hearth.yaml: pages (rooms) hold columns of cards, the sidebar (rail) holds widgets.
To change it: get_dashboard, edit the YAML, validate_dashboard, then save_dashboard with the revision you read. A conflict means someone saved in between; read again and reapply your change.
Keep version: 5, give every page, card, stack, widget and alert a unique id, and use entity ids that exist in Home Assistant. get_schema describes the fields; call it with card or widget for one type's fields.
Open screens show a save after a reload; pass refresh: true to save_dashboard or call refresh_screens.
Every save keeps the previous file; list_versions and get_version read them, and saving a version's content restores it.`;

interface Tool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	annotations?: Record<string, unknown>;
	/**
	 * Tools that change settings or custom CSS, or reload the screens, need an
	 * administrator token. So does any call with refresh: true.
	 */
	admin?: true;
	run: (args: Record<string, unknown>, token: string) => Promise<unknown>;
}

const revisionField = {
	type: 'integer',
	minimum: 0,
	description: 'The revision you read; a save fails with a conflict when the file has moved on'
};
const refreshField = {
	type: 'boolean',
	description: 'Reload every open screen after saving (needs an administrator token)'
};

class ToolFailure extends Error {}

function required<T>(value: T | undefined, message: string): T {
	if (value === undefined) throw new ToolFailure(message);
	return value;
}

function text(args: Record<string, unknown>, key: string): string {
	const value = args[key];
	return required(typeof value === 'string' ? value : undefined, `${key} must be text`);
}

/** A save already happened, so a failed refresh is reported, not thrown. */
async function withRefresh<T extends object>(result: T, token: string, refresh: unknown) {
	if (refresh !== true) return result;
	try {
		await refreshScreens(token);
		return { ...result, refreshed: true };
	} catch (error) {
		return { ...result, refreshed: false, refresh_error: (error as Error).message };
	}
}

async function afterSave(outcome: SaveOutcome, token: string, refresh: unknown) {
	if (!outcome.saved) {
		if ('issues' in outcome) {
			throw new ToolFailure(`Not saved. Fix these issues:\n${outcome.issues.join('\n')}`);
		}
		throw new ToolFailure(
			`Not saved: the file is at revision ${outcome.revision} now. Read it again and reapply your change.`
		);
	}
	return withRefresh({ saved: true, revision: outcome.revision }, token, refresh);
}

function revisionArgument(args: Record<string, unknown>) {
	const revision = args.revision;
	return required(
		Number.isInteger(revision) && (revision as number) >= 0 ? (revision as number) : undefined,
		'revision must be the revision you read'
	);
}

const TOOLS: Tool[] = [
	{
		name: 'get_dashboard',
		description:
			'Read hearth.yaml, the dashboard layout, as YAML text. Its revision field is the revision to save with.',
		inputSchema: { type: 'object', properties: {} },
		annotations: { readOnlyHint: true },
		run: async () => {
			const { yaml } = await readDashboard();
			// a dashboard that was never saved has no file yet
			return yaml.trim() ? yaml : 'revision: 0\n';
		}
	},
	{
		name: 'get_schema',
		description:
			"Describe hearth.yaml as JSON Schema. Without arguments: the overall structure and the card and widget types. With card or widget: that one type's own fields.",
		inputSchema: {
			type: 'object',
			properties: {
				card: { type: 'string', description: 'A card type, such as scenes' },
				widget: { type: 'string', description: 'A widget type, such as clock' }
			}
		},
		annotations: { readOnlyHint: true },
		run: async (args) => {
			for (const kind of ['card', 'widget'] as const) {
				if (typeof args[kind] === 'string') {
					return required(
						typeJsonSchema(kind, args[kind] as string),
						`Hearth has no ${kind} type ${args[kind]}; get_schema without arguments lists them`
					);
				}
			}
			return outlineJsonSchema();
		}
	},
	{
		name: 'validate_dashboard',
		description:
			'Check a complete hearth.yaml without saving it. Returns the issues a save would refuse, or none.',
		inputSchema: {
			type: 'object',
			properties: { yaml: { type: 'string', description: 'The whole document' } },
			required: ['yaml']
		},
		annotations: { readOnlyHint: true },
		run: async (args) => {
			const prepared = prepareDashboard({ yaml: text(args, 'yaml') });
			const issues = 'issues' in prepared ? prepared.issues : [];
			return { valid: issues.length === 0, issues };
		}
	},
	{
		name: 'save_dashboard',
		description:
			'Replace hearth.yaml with a complete document. It is validated first, and the previous file is kept as a version.',
		inputSchema: {
			type: 'object',
			properties: {
				revision: revisionField,
				yaml: { type: 'string', description: 'The whole document, not a fragment' },
				refresh: refreshField
			},
			required: ['revision', 'yaml']
		},
		annotations: { destructiveHint: false, idempotentHint: false },
		run: async (args, token) =>
			afterSave(
				await saveDashboard({ yaml: text(args, 'yaml') }, revisionArgument(args)),
				token,
				args.refresh
			)
	},
	{
		name: 'get_settings',
		description:
			'Read the server settings in configuration.yaml: language, custom JavaScript switch, reduce motion, touch feedback, and whether an access token is stored.',
		inputSchema: { type: 'object', properties: {} },
		annotations: { readOnlyHint: true },
		run: () => readSettings()
	},
	{
		name: 'update_settings',
		description:
			'Change server settings. Fields left out keep their value; null clears one. token is the long-lived access token Hearth hands to every browser.',
		inputSchema: {
			type: 'object',
			properties: {
				revision: revisionField,
				locale: { type: ['string', 'null'], description: 'Default language, such as en or de' },
				custom_js: { type: ['boolean', 'null'] },
				motion: { type: ['boolean', 'null'], description: 'Reduce motion' },
				haptics: { type: ['boolean', 'null'], description: 'Touch feedback' },
				token: { type: ['string', 'null'] },
				refresh: refreshField
			},
			required: ['revision']
		},
		admin: true,
		run: async (args, token) => {
			const change = { ...args };
			delete change.revision;
			delete change.refresh;
			return afterSave(await updateSettings(change, revisionArgument(args)), token, args.refresh);
		}
	},
	{
		name: 'get_custom_css',
		description: 'Read the custom CSS that every screen loads.',
		inputSchema: { type: 'object', properties: {} },
		annotations: { readOnlyHint: true },
		run: () => readCustomCss()
	},
	{
		name: 'save_custom_css',
		description: 'Replace the custom CSS that every screen loads. No version is kept.',
		inputSchema: {
			type: 'object',
			properties: { css: { type: 'string' }, refresh: refreshField },
			required: ['css']
		},
		admin: true,
		run: async (args, token) => {
			await saveCustomCss(text(args, 'css'));
			return withRefresh({ saved: true }, token, args.refresh);
		}
	},
	{
		name: 'list_versions',
		description:
			'List the earlier versions of hearth.yaml, newest first, with the current revision.',
		inputSchema: { type: 'object', properties: {} },
		annotations: { readOnlyHint: true },
		run: () => listVersions()
	},
	{
		name: 'get_version',
		description:
			'Read one earlier version of hearth.yaml by name. To restore it, save its content with save_dashboard.',
		inputSchema: {
			type: 'object',
			properties: { name: { type: 'string', description: 'A name from list_versions' } },
			required: ['name']
		},
		annotations: { readOnlyHint: true },
		run: async (args) => {
			const name = text(args, 'name');
			return required(await readVersion(name), `No version is named ${name}`);
		}
	},
	{
		name: 'refresh_screens',
		description:
			'Reload every open Hearth screen so it shows the saved files. Needs an administrator token.',
		inputSchema: { type: 'object', properties: {} },
		admin: true,
		run: async (_args, token) => {
			await refreshScreens(token);
			return { refreshed: true };
		}
	}
];

type JsonRpcId = string | number | null;

interface JsonRpcMessage {
	jsonrpc?: unknown;
	id?: unknown;
	method?: unknown;
	params?: unknown;
}

function rpcError(id: JsonRpcId, code: number, message: string) {
	return { jsonrpc: '2.0', id, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is JsonRpcId {
	return value === null || typeof value === 'string' || typeof value === 'number';
}

async function callTool(tool: Tool, args: Record<string, unknown>, token: string) {
	try {
		// checked before the tool runs, so a save that cannot refresh is not made
		if (tool.admin || args.refresh === true) {
			const refused = await checkToken(token, 'admin');
			if (refused) throw new ToolFailure(refused.message);
		}
		const result = await tool.run(args, token);
		const text = typeof result === 'string' ? result : JSON.stringify(result);
		return { content: [{ type: 'text', text }] };
	} catch (error) {
		if (!(error instanceof ToolFailure)) console.error(`MCP tool ${tool.name} failed:`, error);
		return {
			content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
			isError: true
		};
	}
}

/** The answer to one message, or undefined for a notification. */
async function answer(message: JsonRpcMessage, token: string): Promise<object | undefined> {
	if (!isRecord(message) || message.jsonrpc !== '2.0') {
		return rpcError(null, -32600, 'Invalid Request');
	}
	const { id, method, params = {} } = message;
	if (id === undefined) return undefined;
	if (!isId(id)) return rpcError(null, -32600, 'Invalid Request');
	if (!isRecord(params)) return rpcError(id, -32602, 'params must be an object');
	switch (method) {
		case 'initialize': {
			const requested = String(params.protocolVersion ?? '');
			return {
				jsonrpc: '2.0',
				id,
				result: {
					protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
					capabilities: { tools: { listChanged: false } },
					serverInfo: { name: 'hearth', title: 'Hearth', version },
					instructions: INSTRUCTIONS
				}
			};
		}
		case 'ping':
			return { jsonrpc: '2.0', id, result: {} };
		case 'tools/list':
			return {
				jsonrpc: '2.0',
				id,
				result: {
					tools: TOOLS.map(({ name, description, inputSchema, annotations }) => ({
						name,
						description,
						inputSchema,
						annotations
					}))
				}
			};
		case 'tools/call': {
			const tool = TOOLS.find(({ name }) => name === params.name);
			if (!tool) return rpcError(id, -32602, `Unknown tool: ${String(params.name)}`);
			const args = params.arguments ?? {};
			if (!isRecord(args)) return rpcError(id, -32602, 'arguments must be an object');
			return { jsonrpc: '2.0', id, result: await callTool(tool, args, token) };
		}
		default:
			return rpcError(id, -32601, `Method not found: ${String(method)}`);
	}
}

function originOf(url: string | undefined): string | undefined {
	if (!url) return undefined;
	try {
		return new URL(url).origin;
	} catch {
		return undefined;
	}
}

/**
 * The transport checks the specification asks for before anything else: a
 * browser page from another origin is refused (DNS rebinding), and so is a
 * protocol version Hearth does not speak. Clients outside a browser send no
 * Origin, and a missing version header means the client predates it.
 */
export function transportIssue(request: Request): Response | undefined {
	const origin = request.headers.get('origin');
	if (origin !== null) {
		const allowed = [originOf(request.url), originOf(process.env.HASS_PUBLIC_URL)];
		const parsed = originOf(origin);
		if (!parsed || !allowed.includes(parsed)) {
			return Response.json(rpcError(null, -32600, `Origin ${origin} is not allowed`), {
				status: 403
			});
		}
	}
	const protocol = request.headers.get('mcp-protocol-version');
	if (protocol !== null && !PROTOCOL_VERSIONS.includes(protocol)) {
		return Response.json(rpcError(null, -32600, `Unsupported protocol version ${protocol}`), {
			status: 400
		});
	}
	return undefined;
}

/** Handles one POST to the MCP endpoint from an authorized caller. */
export async function handleMcp(request: Request, token: string): Promise<Response> {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return Response.json(rpcError(null, -32700, 'Parse error'), { status: 400 });
	}
	const batch = Array.isArray(payload);
	const messages = (batch ? payload : [payload]) as JsonRpcMessage[];
	if (!messages.length) return Response.json(rpcError(null, -32600, 'Invalid Request'));
	if (messages.length > MAX_BATCH) {
		return Response.json(rpcError(null, -32600, `A batch may hold at most ${MAX_BATCH} messages`), {
			status: 400
		});
	}
	const answers = (
		await Promise.all(
			messages.map((message) =>
				answer(message, token).catch((error) => {
					console.error('MCP request failed:', error);
					const id = isRecord(message) ? message.id : null;
					if (id === undefined) return undefined;
					return rpcError(isId(id) ? id : null, -32603, 'Internal error');
				})
			)
		)
	).filter((entry) => entry !== undefined);
	if (!answers.length) return new Response(null, { status: 202 });
	return Response.json(batch ? answers : answers[0]);
}
