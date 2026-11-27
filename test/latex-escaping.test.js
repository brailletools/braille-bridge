import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DualDocument, escapeLatexProse, latexProseToText } from '../src/index.js';

// The back-translation is stubbed with a fixed string: what matters here is what
// happens to prose that contains LaTeX's special characters, wherever it came from.
const NASTY = 'Tom & Jerry_1 #2 50% {x} $5 ^ ~ \\5/ \\45/ a\\b';

const translateTo = (text) => async () => text;
const identityForward = async (text) => text;

function docWith(prose) {
	return DualDocument.fromBraille('HELLO', { translate: translateTo(prose), translateForward: identityForward });
}

test('prose containing LaTeX special characters (and liblouis `\\5/` marks) is escaped in the LaTeX output', async () => {
	const doc = await docWith(NASTY);
	const latex = await doc.renderLatex();
	assert.equal(
		latex.trim(),
		'Tom \\& Jerry\\_1 \\#2 50\\% \\{x\\} \\$5 \\textasciicircum{} \\textasciitilde{} ' +
			'\\textbackslash{}5/ \\textbackslash{}45/ a\\textbackslash{}b'
	);
	// No bare special character is left outside an escape sequence.
	assert.doesNotMatch(latex.replace(/\\(?:textbackslash\{\}|textascii\w+\{\}|[{}$&#_%])/g, ''), /[\\{}$&#_%^~]/);
});

test('escapeLatexProse and latexProseToText are inverses', () => {
	for (const text of [NASTY, '', 'plain', '\\textbf{not markup}', '}{', '\\\\', '$$', 'a\nb']) {
		assert.equal(latexProseToText(escapeLatexProse(text)), text);
	}
});

test('latexProseToText drops markup wrappers but keeps their content and any escaped braces', () => {
	assert.equal(latexProseToText('\\textbf{bold \\} brace} and \\textit{it}'), 'bold } brace and it');
	assert.equal(latexProseToText('\\underline{a}\\&b'), 'a&b');
});

test('editing a paragraph in the LaTeX pane translates the text, not its escapes', async () => {
	let forwarded;
	const doc = await DualDocument.fromBraille('HELLO', {
		translate: translateTo('Fish & chips'),
		translateForward: async (text) => ((forwarded = text), 'FISH')
	});
	const edited = 'Fish \\& chips \\$5 \\textbackslash{}5/\n\n';
	await doc.applyLatexEdit(edited, edited.length);
	assert.equal(forwarded, 'Fish & chips $5 \\5/');
});

test('an escaped dollar sign is prose, not the start of inline math', async () => {
	let forwarded;
	const doc = await DualDocument.fromBraille('HELLO', {
		translate: translateTo('costs $5 and $6'),
		translateForward: async (text) => ((forwarded = text), 'X')
	});
	const latex = await doc.renderLatex();
	assert.match(latex, /costs \\\$5 and \\\$6/);
	const edited = latex.replace('costs', 'cost');
	await doc.applyLatexEdit(edited, edited.length);
	assert.equal(forwarded, 'cost $5 and $6', 'the two \\$ must not be read as a math span');
});

test('real inline math next to escaped dollars still round-trips as math', async () => {
	const doc = await DualDocument.fromBraille('HELLO\n\n_%3+4_:', {
		translate: translateTo('A & B'),
		translateForward: identityForward
	});
	const latex = await doc.renderLatex();
	assert.match(latex, /A \\& B/);
	assert.match(latex, /\$3\+4\$|\$\$3\+4\$\$/);
});

test('bold and italic runs escape their text too', async () => {
	const doc = await DualDocument.fromBraille(',.,.,.', { translate: translateTo('R&D'), translateForward: identityForward });
	assert.ok(!(await doc.renderLatex()).includes('R&D'));
});
