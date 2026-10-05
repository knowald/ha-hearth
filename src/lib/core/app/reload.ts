/*
 * Every page reload in the app goes through reloadPage. A module that keeps
 * the page in a state a reload must not start from registers a hook here:
 * the overlay layers take their history entry off with an asynchronous
 * history.back(), and a reload started before that traversal lands is
 * aborted by it. A hook that has to wait returns a promise; with none
 * waiting, the reload starts at once.
 */

type BeforeReload = () => void | Promise<void>;

const beforeReload = new Set<BeforeReload>();

/** Runs `hook` before every reload; returns a function that removes it. */
export function onBeforeReload(hook: BeforeReload): () => void {
	beforeReload.add(hook);
	return () => beforeReload.delete(hook);
}

export function reloadPage(): Promise<void> {
	const waits = [...beforeReload].map((hook) => hook()).filter(Boolean);
	if (!waits.length) {
		location.reload();
		return Promise.resolve();
	}
	return Promise.all(waits).then(() => location.reload());
}

/*
 * A page reload Home Assistant asks for (the HEARTH `refresh` event). While
 * the dashboard holds reloads, a request waits and runs once the hold ends.
 */

let held = false;
let pending = false;

function reload() {
	sessionStorage.setItem('event', 'refresh');
	void reloadPage();
}

export function requestReload() {
	if (held) pending = true;
	else reload();
}

export function holdReloads(hold: boolean) {
	held = hold;
	if (held || !pending) return;
	pending = false;
	reload();
}
