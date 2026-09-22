/*
 * Flags user-facing text written directly into a Svelte template instead of
 * going through $lang(). Applies to text nodes, to the attributes that render
 * as copy (label, title, aria-label and friends), and to string literals in
 * expressions and TypeScript helpers that read as a sentence: two or more
 * words in a row. Object properties that feed those attributes (label,
 * title and friends) count as copy even as a single word. Placeholders show
 * example values, which are often data (entity ids, states, URLs); only ones
 * that read as a capitalised word or phrase are flagged.
 * Diagnostics (thrown errors, console output) and technical strings (entity
 * ids, CSS, URLs, templates) are data, not copy. A literal that is copy for a
 * reason the rule cannot see carries a same-line `// copy ok: <reason>`.
 */

const COPY_ATTRIBUTES = new Set([
	'label',
	'title',
	'aria-label',
	'confirmLabel',
	'removeLabel',
	'text',
	'name',
	'sub',
	'alt',
	'placeholder'
]);

// object keys whose string values end up in the same attributes
const COPY_PROPERTIES = new Set(['label', 'title', 'sub', 'text', 'confirmLabel', 'removeLabel']);

// attributes whose string values are identifiers, never copy
const IDENTIFIER_ELEMENTS = new Set(['Icon', 'svelte:element', 'input', 'meta', 'link']);

// two letters in a row is the smallest thing that reads as a word, in any
// script; symbols, units and numbers pass
const WORD = /\p{L}{2,}/u;

// units and symbols that are the same in every language
const UNITS = new Set(['kWh', 'Wh', 'px', 'ppm', 'dB', 'ms', 'min', 'km', 'kg']);

function isCopy(text) {
	const trimmed = text.replace(/\s+/g, ' ').trim();
	if (!WORD.test(trimmed)) return false;
	if (UNITS.has(trimmed)) return false;
	// technical tokens carry a separator or digit: entity ids, css values,
	// urls; a plain lowercase word such as "save" is copy
	if (/^[a-z0-9_.:/#%*-]+$/.test(trimmed) && /[0-9_.:/#%*-]/.test(trimmed)) return false;
	return true;
}

// "Living room" is an example the reader would translate; "light.kitchen_*",
// "running, rinse, spin" and "Europe/Warsaw" are values they would type as-is
function isPlaceholderCopy(text) {
	const trimmed = text.trim();
	return isCopy(trimmed) && /^\p{Lu}/u.test(trimmed) && !/[/_{}()]/.test(trimmed);
}

// a sentence: two words in a row, which no identifier, key or unit contains
const SENTENCE = /[A-Za-z]{2,}[ ,.!?;:]+[A-Za-z]{2,}/;

function isSentence(raw) {
	const text = raw.trim();
	if (!SENTENCE.test(text)) return false;
	// html, media queries and yaml samples are data
	if (/^[<(]|^[a-z_]+:\s/.test(text)) return false;
	// templates, css, urls, paths, entity ids and link relations are data
	if (
		/\{\{|\}\}|:\/\/|^[a-z0-9_.:/#%*-]+$|^[.#[]|, \.|\b(px|em|rem|vh|vw|solid|calc|var)\(?\b|^noopener/.test(
			text
		)
	) {
		return false;
	}
	return true;
}

// literals under these are diagnostics or identifiers, not copy
function isDataContext(node) {
	for (let parent = node.parent; parent; parent = parent.parent) {
		if (parent.type === 'ImportDeclaration' || parent.type === 'ImportExpression') return true;
		if (parent.type === 'ThrowStatement') return true;
		if (parent.type === 'NewExpression' && /Error$/.test(parent.callee?.name ?? '')) return true;
		if (parent.type === 'CallExpression') {
			const callee = parent.callee;
			// an error subclass passing its message up
			if (callee?.type === 'Super') return true;
			if (callee?.type === 'MemberExpression') {
				const object = callee.object?.name;
				// console output, valibot schema messages and YAML issue lines are
				// diagnostics that quote paths and YAML terms, not product copy
				if (object === 'console' || object === 'v' || object === 'issues') return true;
			}
			// $lang('key') and translation lookups take keys
			if (callee?.name === '$lang' || callee?.name === 'lang') return true;
		}
		// placeholders show example values
		if (parent.type === 'SvelteAttribute' && parent.key?.name === 'placeholder') return true;
		if (parent.type === 'TSLiteralType' || parent.type === 'TSEnumMember') return true;
		if (parent.type === 'Property' && (parent.key === node || parent.key?.name === 'placeholder')) {
			return true;
		}
	}
	return false;
}

function exemptedByComment(context, node) {
	const line = node.loc.end.line;
	return context.sourceCode
		.getAllComments()
		.some((comment) => comment.loc.start.line === line && /copy ok/.test(comment.value));
}

export default {
	meta: {
		type: 'problem',
		docs: { description: 'user-facing text must go through $lang()' },
		schema: []
	},
	create(context) {
		return {
			SvelteText(node) {
				for (let parent = node.parent; parent; parent = parent.parent) {
					if (parent.type === 'SvelteStyleElement' || parent.type === 'SvelteScriptElement') return;
				}
				if (!isCopy(node.value)) return;
				context.report({ node, message: `Bare text "${node.value.trim()}": use $lang()` });
			},
			Literal(node) {
				if (typeof node.value !== 'string') return;
				const property =
					node.parent?.type === 'Property' && node.parent.value === node
						? node.parent.key?.name
						: undefined;
				const copy = COPY_PROPERTIES.has(property) ? isCopy(node.value) : isSentence(node.value);
				if (!copy) return;
				if (isDataContext(node) || exemptedByComment(context, node)) return;
				context.report({ node, message: `Bare copy "${node.value.trim()}": use $lang()` });
			},
			TemplateLiteral(node) {
				const text = node.quasis.map((quasi) => quasi.value.cooked ?? '').join(' ');
				if (!isSentence(text)) return;
				if (isDataContext(node) || exemptedByComment(context, node)) return;
				context.report({ node, message: `Bare copy "${text.trim()}": use $lang()` });
			},
			SvelteAttribute(node) {
				const key = node.key?.name;
				if (!COPY_ATTRIBUTES.has(key)) return;
				const parentName = node.parent?.parent?.name?.name ?? node.parent?.parent?.name;
				if (key === 'name' && parentName !== undefined && parentName !== 'TextField') return;
				if (IDENTIFIER_ELEMENTS.has(parentName) && key !== 'placeholder') return;
				if (node.value.length !== 1) return;
				const value = node.value[0];
				// title="Delete" and title={'Delete'} are the same mistake
				const text =
					value.type === 'SvelteLiteral'
						? value.value
						: value.type === 'SvelteMustacheTag' &&
							  value.expression?.type === 'Literal' &&
							  typeof value.expression.value === 'string'
							? value.expression.value
							: undefined;
				if (text === undefined) return;
				if (key === 'placeholder' ? !isPlaceholderCopy(text) : !isCopy(text)) return;
				context.report({
					node: value,
					message: `Bare ${key} "${text.trim()}": use $lang()`
				});
			}
		};
	}
};
