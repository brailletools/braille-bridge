import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lex, DualDocument, ascii2Braille } from '../src/index.js';

const identity = async (t) => t;
const opts = { table: 'en-ueb-g2.ctb', translate: identity, translateForward: identity };

test('lex() default: single newlines stay inside one paragraph; { linesAreParagraphs } splits on every line', () => {
	assert.equal(lex('AA\nBB\n\nCC').children.length, 2);
	const tree = lex('AA\nBB\n\nCC', { linesAreParagraphs: true });
	assert.equal(tree.paragraphSeparator, '\n');
	// 'AA', 'BB', '' (the blank line), 'CC' -- a blank line is its own empty paragraph, so
	// the braille text round-trips exactly.
	assert.equal(tree.children.length, 4);
	assert.deepEqual(
		tree.children.map((n) => n.brailleRange),
		[{ start: 0, end: 2 }, { start: 3, end: 5 }, { start: 6, end: 6 }, { start: 7, end: 9 }]
	);
});

test('a lines-are-paragraphs document renders a blank line between lines in LaTeX and Markdown', async () => {
	const doc = await DualDocument.fromBraille('AA\nBB\nCC\n', { ...opts, linesAreParagraphs: true });
	assert.equal(doc.linesAreParagraphs, true);
	assert.equal(doc.brailleText, 'AA\nBB\nCC\n', 'braille text is untouched -- no blank lines inserted');
	// The identity translator leaves the Unicode-braille form of AA/BB/CC in the output.
	const [aa, bb, cc] = ['AA', 'BB', 'CC'].map(ascii2Braille);
	const blankBetween = new RegExp(`${aa}\\n\\n${bb}\\n\\n${cc}`);
	assert.match(await doc.renderLatex(), blankBetween);
	assert.match(await doc.renderMarkdown(), blankBetween);
	const merged = await DualDocument.fromBraille('AA\nBB\nCC\n', opts);
	assert.doesNotMatch(await merged.renderLatex(), new RegExp(`${aa}\\n\\n${bb}`), 'default mode still merges them into one paragraph');
});

// Property: after any sequence of incremental braille-pane edits, the document must be
// exactly what a fresh load of the final text would produce (same braille, same ranges,
// same LaTeX) -- otherwise the range math has drifted from the separator in use.
test('incremental braille edits in lines-are-paragraphs mode match a fresh load of the final text', async () => {
	const edits = [
		(t) => t.replace('BB', 'BBX'), // within a line
		(t) => t.replace('AA\n', 'AA\nNEW\n'), // insert a line
		(t) => t.replace('\nCC', ''), // delete a line
		(t) => t + '\nTAIL', // append
		(t) => t.replace('NEW\n', 'NEW\n\n') // insert a blank line (an empty paragraph)
	];
	let text = 'AA\nBB\nCC';
	const doc = await DualDocument.fromBraille(text, { ...opts, linesAreParagraphs: true });
	for (const edit of edits) {
		const next = edit(text);
		const at = [...next].findIndex((c, i) => c !== text[i]);
		await doc.applyBrailleEdit(next, at === -1 ? next.length : at);
		text = next;
		const fresh = await DualDocument.fromBraille(text, { ...opts, linesAreParagraphs: true });
		assert.equal(doc.brailleText, fresh.brailleText);
		assert.deepEqual(doc._tree.children.map((n) => n.brailleRange), fresh._tree.children.map((n) => n.brailleRange), `ranges after edit -> ${JSON.stringify(text)}`);
		assert.equal(await doc.renderLatex(), await fresh.renderLatex(), `latex after edit -> ${JSON.stringify(text)}`);
	}
});

test('editing from the LaTeX pane in lines-are-paragraphs mode keeps the one-newline separators', async () => {
	const doc = await DualDocument.fromBraille('AA\nBB\nCC', { ...opts, linesAreParagraphs: true });
	const latex = await doc.renderLatex();
	const at = latex.indexOf('BB') + 2;
	await doc.applyLatexEdit(latex.slice(0, at) + 'Z' + latex.slice(at), at + 1);
	assert.equal(doc.brailleText.split('\n').length, 3);
	assert.equal(doc.linesAreParagraphs, true);
	const fresh = await DualDocument.fromBraille(doc.brailleText, { ...opts, linesAreParagraphs: true });
	assert.deepEqual(doc._tree.children.map((n) => n.brailleRange), fresh._tree.children.map((n) => n.brailleRange));
});

test('fromMarkdown() with linesAreParagraphs joins paragraphs with one newline and flattens soft wraps', async () => {
	const doc = await DualDocument.fromMarkdown('first line\nsoft wrapped\n\nsecond', { ...opts, linesAreParagraphs: true });
	assert.equal(doc.linesAreParagraphs, true);
	assert.equal(doc.brailleText, 'first line soft wrapped\nsecond');
	const fresh = await DualDocument.fromBraille(doc.brailleText, { ...opts, linesAreParagraphs: true });
	assert.deepEqual(doc._tree.children.map((n) => n.brailleRange), fresh._tree.children.map((n) => n.brailleRange));
});
