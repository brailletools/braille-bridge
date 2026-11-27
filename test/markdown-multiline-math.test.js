// Multi-line display math arriving through Markdown (directly, or from a .tex/.docx
// upload that Pandoc converted to Markdown).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DualDocument, latex_to_nemeth } from '../src/index.js';

const identity = async (t) => t;
const options = (linesAreParagraphs) => ({ translate: identity, translateForward: identity, linesAreParagraphs });

async function load(markdown, linesAreParagraphs) {
	const doc = await DualDocument.fromMarkdown(markdown, options(linesAreParagraphs));
	// The braille it produced must mean the same thing when loaded again on its own.
	const reloaded = await DualDocument.fromBraille(doc.brailleText, options(linesAreParagraphs));
	assert.equal(reloaded.latexText.trim(), doc.latexText.trim());
	return doc;
}

for (const lines of [false, true]) {
	const mode = `linesAreParagraphs=${lines}`;

	test(`a math line starting with + or - is not mistaken for a list (${mode})`, async () => {
		for (const op of ['+', '-']) {
			const doc = await load(`$$x = 1\n${op} 2$$`, lines);
			assert.deepEqual(doc.errors, []);
			assert.equal(doc.latexText.trim(), `$x = 1${op}2$`);
		}
	});

	test(`line environments become one braille line per row (${mode})`, async () => {
		for (const name of ['align', 'align*', 'gather', 'aligned']) {
			const doc = await load(`$$\\begin{${name}}\nx &= 1 \\\\\ny &= 2 \\nonumber\n\\end{${name}}$$`, lines);
			assert.deepEqual(doc.errors, [], name);
			assert.equal(doc.latexText.trim(), '$$x = 1$$\n$$y = 2$$', name);
		}
	});

	test(`equation, label and a nested split are unwrapped (${mode})`, async () => {
		const one = await load('$$\\begin{equation}\\label{e}\nx = 1\n\\end{equation}$$', lines);
		assert.equal(one.latexText.trim(), '$$x = 1$$');
		const split = await load('$$\\begin{equation}\\begin{split}\nx &= 1 \\\\\n &= 2\n\\end{split}\\end{equation}$$', lines);
		assert.equal(split.latexText.trim(), '$$x = 1$$\n$$= 2$$');
	});

	test(`a matrix keeps its rows (${mode})`, async () => {
		const doc = await load('$$\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$$', lines);
		assert.equal(doc.latexText.trim(), '$$\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$$');
	});

	test(`inline math may wrap onto the next line (${mode})`, async () => {
		const doc = await load('We have $x +\ny$ here.', lines);
		assert.match(doc.latexText, /\$x\+y\$/);
	});
}

test('dollar amounts on neighbouring lines are not read as math', async () => {
	const doc = await DualDocument.fromMarkdown('costs $5\nand $6 more', options(false));
	assert.doesNotMatch(doc.brailleText, /_%/);
});

test('unsupported environments are still reported', () => {
	assert.throws(() => latex_to_nemeth('\\begin{cases} 1 \\\\ 2 \\end{cases}'), /environment cases/);
});
