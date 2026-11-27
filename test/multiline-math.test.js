// Math blocks that span several braille lines: paragraph splitting must not cut them
// apart, and an expression wrapped inside a fraction/bracket must stay one equation.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DualDocument, nemeth_display_lines } from '../src/index.js';
import { paragraphRanges } from '../src/processFile.js';

const identity = async (t) => t;
const options = (linesAreParagraphs) => ({ translate: identity, translateForward: identity, linesAreParagraphs });
const load = (text, lines = false) => DualDocument.fromBraille(text, options(lines));
const slices = (text, separator) => paragraphRanges(text, separator).map((r) => text.slice(r.start, r.end));

test('paragraphRanges never cuts a closed math block, but does split around it', () => {
	assert.deepEqual(slices('a\n_%\nx\ny\n_:\nb', '\n'), ['a', '_%\nx\ny\n_:', 'b']);
	assert.deepEqual(slices('_% x\n\ny _:\n\nb', '\n\n'), ['_% x\n\ny _:', 'b']);
});

test('paragraphRanges: an unclosed block does not swallow what follows', () => {
	assert.deepEqual(slices('_% x\ny\nz', '\n'), ['_% x', 'y', 'z']);
	assert.deepEqual(slices('_% x\n\ntext\n\n_% y _:', '\n\n'), ['_% x', 'text', '_% y _:']);
});

test('a stray closing symbol does not hide a later unclosed one', () => {
	assert.equal(nemeth_display_lines(')(a+\nb)').length, 1);
});

test('grouping symbols seen only during a backtracked parse are not counted', () => {
	// `(` first tries to parse as a binomial, backs out, and is then read again.
	assert.equal(nemeth_display_lines('((a))\ny .k 2').length, 2);
	assert.equal(nemeth_display_lines('((a+\nb))\ny .k 2').length, 2);
});

test('paragraphRanges: several blocks, including nested ones', () => {
	assert.deepEqual(slices('_% a\n_% b\nc _:\nd _:\ne\n_% f\ng _:\nh', '\n'), [
		'_% a\n_% b\nc _:\nd _:',
		'e',
		'_% f\ng _:',
		'h'
	]);
});

for (const lines of [false, true]) {
	test(`one equation per line renders as display math (linesAreParagraphs=${lines})`, async () => {
		const doc = await load('_%\nx .k 1\ny .k 2\n_:', lines);
		assert.equal(doc.latexText.trim(), '$$x = 1$$\n$$y = 2$$');
	});
}

test('a blank line inside a block does not end the block', async () => {
	const doc = await load('_%\nx .k 1\n\ny .k 2\n_:');
	assert.equal(doc.latexText.trim(), '$$x = 1$$\n$$y = 2$$');
});

test('lines wrapped inside a fraction, bracket or radical are one equation', () => {
	assert.equal(nemeth_display_lines('?x+1\n/2#').length, 1);
	assert.equal(nemeth_display_lines('?x\n+1/\n2#').length, 1);
	assert.deepEqual(nemeth_display_lines('x .k (a+\nb)'), ['x = (a+ b)']);
	assert.equal(nemeth_display_lines('>x+\n1]').length, 1);
	assert.equal(nemeth_display_lines('?x+1\n\n/2#\ny .k 2').length, 2);
});

test('something that never closes does not swallow the following lines', () => {
	assert.equal(nemeth_display_lines('.(x .k 1\ny .k 2').length, 2);
	assert.equal(nemeth_display_lines('(a\nb\nc').length, 3);
});

for (const lines of [false, true]) {
	test(`typing and deleting a block's markers matches a fresh load (linesAreParagraphs=${lines})`, async () => {
		const body = 'intro\n\n_%\nx .k 1\n\ny .k 2\n\nz .k 3\n';
		const doc = await load(body, lines);
		for (const text of [`${body}_`, `${body}_:`, `${body}_:\n\nend`, `intro\n\n${body.slice(9)}_:\n\nend`, `${body}_:\n\nend`, body]) {
			await doc.applyBrailleEdit(text, text.length);
			const fresh = await load(text, lines);
			assert.equal(doc.latexText, fresh.latexText, JSON.stringify(text));
			assert.deepEqual(
				doc.topLevelNodes.map((n) => n.brailleRange),
				fresh.topLevelNodes.map((n) => n.brailleRange),
				JSON.stringify(text)
			);
		}
	});
}

test('an edit that only touches one paragraph leaves the others (and their ids) alone', async () => {
	const doc = await load('one\n\ntwo\n\nthree');
	const ids = doc.topLevelNodes.map((n) => n.docId);
	await doc.applyBrailleEdit('one\n\ntwoo\n\nthree', 9);
	assert.deepEqual(doc.topLevelNodes.map((n) => n.docId), ids);
});
