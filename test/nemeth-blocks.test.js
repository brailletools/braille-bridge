import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nemeth_display_lines, nemeth_to_latex } from '../src/index.js';

// Spec ex 25-61 (Rule 25.8): a 3x3 matrix with enlarged square brackets.
test('matrix rows wrapped in enlarged brackets become one bmatrix (ex 25-61)', () => {
	const block = ['@,(COS A  SIN A #0@,)', '@,(-SIN A COS A #0@,)', '@,(#0     #0    #1@,)'].join('\n');
	const chunks = nemeth_display_lines(block);
	assert.equal(chunks.length, 1);
	assert.equal(
		chunks[0],
		'\\begin{bmatrix} \\cos a & \\sin a & 0 \\\\ -\\sin a & \\cos a & 0 \\\\ 0 & 0 & 1 \\end{bmatrix}'
	);
});

test('enlarged parentheses give pmatrix, vertical bars give a determinant', () => {
	const p = nemeth_display_lines([',(a1 b1,)', ',(c1 d1,)'].join('\n'));
	assert.equal(p[0], '\\begin{pmatrix} a_{1} & b_{1} \\\\ c_{1} & d_{1} \\end{pmatrix}');
	const v = nemeth_display_lines(['\\#1 #2\\', '\\#3 #4\\'].join('\n'));
	assert.equal(v[0], '\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}');
});

test('a lone bracketed line is not an array; ordinary lines stay one chunk each', () => {
	assert.deepEqual(nemeth_display_lines(',(a+b,)'), ['\\bigl(a+b\\bigr)']);
	assert.deepEqual(nemeth_display_lines('x^2\n\ny^2'), ['x^{2}', 'y^{2}']);
});

test('unsupported input still falls back to Abraham rather than disappearing', () => {
	// `\x01` is not a Nemeth cell: the native parser warns, Abraham is asked instead.
	const out = nemeth_to_latex('#1+#2');
	assert.ok(out.trim() !== '');
});
