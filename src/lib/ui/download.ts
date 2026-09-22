/**
 * Hands the browser a generated file. The object URL is revoked on the next
 * frame: revoking it in the same tick cancels the download in some browsers.
 */
export function downloadText(name: string, text: string, type = 'text/yaml') {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const link = document.createElement('a');
	link.href = url;
	link.download = name;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** The text of a file the user picked, or undefined when the picker was dismissed. */
export function pickTextFile(accept: string): Promise<string | undefined> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.style.display = 'none';
		document.body.append(input);
		const finish = (text: string | undefined) => {
			input.remove();
			resolve(text);
		};
		input.addEventListener('change', () => {
			const file = input.files?.[0];
			if (!file) return finish(undefined);
			file.text().then(finish, () => finish(undefined));
		});
		// the picker reports nothing when it is dismissed in a browser without
		// the cancel event, so the input is only cleaned up on a pick there
		input.addEventListener('cancel', () => finish(undefined));
		input.click();
	});
}
