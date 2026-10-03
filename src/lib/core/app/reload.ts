/*
 * A page reload Home Assistant asks for (the HEARTH `refresh` event). While
 * the dashboard holds reloads, a request waits and runs once the hold ends.
 */

let held = false;
let pending = false;

function reload() {
	sessionStorage.setItem('event', 'refresh');
	location.reload();
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
