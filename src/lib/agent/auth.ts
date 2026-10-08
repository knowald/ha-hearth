import { createHash } from 'crypto';

/*
 * Writes take a Home Assistant access token as a bearer token: the browser
 * sends the token of its own Home Assistant connection, agents a long-lived
 * one. A token is accepted when Home Assistant accepts it. Settings and custom
 * CSS also need the token's user to be an administrator, which only the
 * websocket API reports. Both answers are remembered for a minute so a burst
 * of calls does not ask every time, and calls that arrive while a token is
 * being checked wait for that check instead of starting their own.
 */

export type Access = 'user' | 'admin';

const REMEMBER_MS = 60_000;
const TIMEOUT_MS = 10_000;
const accepted = new Map<string, number>();
const administrators = new Map<string, { admin: boolean; until: number }>();
const checking = new Map<string, Promise<Refusal | undefined>>();
const lookingUp = new Map<string, Promise<boolean>>();

/** HASS_URL without a trailing slash, ready for a path to be appended. */
export function hassUrl(): string | undefined {
	return process.env.HASS_URL?.replace(/\/+$/, '') || undefined;
}

/** The pending `start()` for `key`, started only when none is pending. */
function shared<T>(pending: Map<string, Promise<T>>, key: string, start: () => Promise<T>) {
	let promise = pending.get(key);
	if (!promise) {
		promise = start().finally(() => pending.delete(key));
		pending.set(key, promise);
	}
	return promise;
}

function fingerprint(token: string) {
	return createHash('sha256').update(token).digest('hex');
}

function refusal(message: string, status = 401) {
	return Response.json(
		{ error: message },
		{ status, headers: status === 401 ? { 'WWW-Authenticate': 'Bearer realm="hearth"' } : {} }
	);
}

function forget(cache: Map<string, number | { until: number }>, now: number) {
	for (const [key, entry] of cache) {
		if ((typeof entry === 'number' ? entry : entry.until) <= now) cache.delete(key);
	}
}

export function bearerToken(request: Request): string | undefined {
	return /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
}

/** Whether the token's user is a Home Assistant administrator, from auth/current_user. */
async function currentUserIsAdmin(base: string, token: string): Promise<boolean> {
	const socket = new WebSocket(`${base.replace(/^http/, 'ws')}/api/websocket`);
	try {
		return await new Promise<boolean>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('timed out')), TIMEOUT_MS);
			const fail = (error: Error) => {
				clearTimeout(timer);
				reject(error);
			};
			socket.addEventListener('error', () => fail(new Error('connection failed')));
			socket.addEventListener('close', () => fail(new Error('connection closed')));
			socket.addEventListener('message', (event) => {
				let message;
				try {
					message = JSON.parse(String(event.data));
				} catch {
					// a throw here would escape the promise as an uncaught exception
					fail(new Error('Home Assistant sent a message that is not JSON'));
					return;
				}
				if (message.type === 'auth_required') {
					socket.send(JSON.stringify({ type: 'auth', access_token: token }));
				} else if (message.type === 'auth_ok') {
					socket.send(JSON.stringify({ id: 1, type: 'auth/current_user' }));
				} else if (message.type === 'auth_invalid') {
					fail(new Error('token refused'));
				} else if (message.type === 'result' && message.id === 1) {
					clearTimeout(timer);
					if (message.success) resolve(message.result?.is_admin === true);
					else reject(new Error(message.error?.message ?? 'auth/current_user failed'));
				}
			});
		});
	} finally {
		socket.close();
	}
}

export interface Refusal {
	status: 401 | 403 | 503;
	message: string;
}

const UNREACHABLE: Refusal = {
	status: 503,
	message: 'Home Assistant could not be reached to check the token'
};

/** Asks Home Assistant whether it accepts the token, and remembers a yes. */
async function acceptance(base: string, token: string, key: string): Promise<Refusal | undefined> {
	let response: Response;
	try {
		response = await fetch(`${base}/api/`, {
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return UNREACHABLE;
	}
	if (response.status === 401 || response.status === 403) {
		accepted.delete(key);
		administrators.delete(key);
		return { status: 401, message: 'Home Assistant did not accept the token' };
	}
	// a proxy error or a restarting Home Assistant says nothing about the token
	if (!response.ok) return UNREACHABLE;
	const now = Date.now();
	forget(accepted, now);
	accepted.set(key, now + REMEMBER_MS);
	return undefined;
}

/** Why the token may not have `access`, or undefined when it may. */
export async function checkToken(token: string, access: Access): Promise<Refusal | undefined> {
	const base = hassUrl();
	if (!base) return { status: 503, message: 'HASS_URL is not set, so tokens cannot be checked' };
	const key = fingerprint(token);

	if ((accepted.get(key) ?? 0) <= Date.now()) {
		const refused = await shared(checking, key, () => acceptance(base, token, key));
		if (refused) return refused;
	}
	if (access === 'user') return undefined;

	let admin = administrators.get(key);
	if (!admin || admin.until <= Date.now()) {
		try {
			admin = {
				admin: await shared(lookingUp, key, () => currentUserIsAdmin(base, token)),
				until: Date.now() + REMEMBER_MS
			};
		} catch (error) {
			console.error('Home Assistant user lookup failed:', error);
			return { status: 503, message: 'Home Assistant could not say who the token belongs to' };
		}
		forget(administrators, Date.now());
		administrators.set(key, admin);
	}
	return admin.admin
		? undefined
		: { status: 403, message: 'This needs a Home Assistant administrator' };
}

/** The caller's token, or the response that refuses the request. */
export async function authorize(
	request: Request,
	access: Access = 'user'
): Promise<{ token: string } | Response> {
	const token = bearerToken(request);
	if (!token) return refusal('A Home Assistant access token is required as a bearer token');
	const refused = await checkToken(token, access);
	return refused ? refusal(refused.message, refused.status) : { token };
}
