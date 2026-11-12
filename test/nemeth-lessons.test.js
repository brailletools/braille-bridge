import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nemethToLatexDetailed } from '../src/nemeth/toLatex.js';
import { latexToNemeth } from '../src/nemeth/toNemeth.js';

// Worked examples from the Nemeth tutorial at https://nemeth.aphtech.org (lessons 1-11), taken from
// the page HTML (the braille cells and the print math), not retyped. Each row is
//   [lesson.example, Nemeth ASCII braille, LaTeX for the print form, braille LaTeX regenerates to].
// The last column is omitted when it is the input itself. Every row checks both directions.
// These are the cases that exposed gaps in the first spec-based translator: comparison signs that
// look like decimals, stacked limits (sigma, integral, lim), radical indexes and orders, the
// vector/ray/line/arc modifiers, logic negation, lists inside enclosures and leading decimals.
const LESSON_CASES = [
	// 1.6, 6.2: comparison signs are not decimal points
	['1.6.1', '#9 .1 #4', '9 > 4'],
	['6.2.8', '#9 .1: #5', '9 \\geq 5'],
	['2.2.6', '#.26 .1 #.18', '.26 > .18'],
	// 2.2: a leading decimal point takes the numeric indicator
	['2.2.3', '#.65', '.65'],
	['2.2.5', '#.50+.25', '.50+.25'],
	// 3.4, 5.4, 6.3: no numeric indicator after the comma-space of a list inside an enclosure
	['5.4.1', '(1, 2)', '(1, 2)'],
	['5.4.5', '(X+6, 2Y-3)', '(x+6, 2y-3)'],
	['6.3.7', '.(5, -1, 2, R, P, ,B.)', '\\{5, -1, 2, r, p, B\\}'],
	// 11.6: index of a radical after a coefficient; order dots come before the index
	['11.6.5', '#5<3>64]', '5\\sqrt[3]{64}'],
	['11.6.7', '>.<3>8000.]]', '\\sqrt{\\sqrt[3]{8000}}'],
	// 11.8: limits written under `lim`
	['11.8.1', '"LIM%X $O #7] #3X', '\\lim_{x \\to 7} 3x'],
	['11.8.3', '"LIM%N $O ,=] A;N', '\\lim_{n \\to \\infty} a_{n}'],
	['11.8.5', '?"LIM%X $O #1] F(X)/"LIM%X $O #1] G(X)#', '\\frac{\\lim_{x \\to 1} f(x)}{\\lim_{x \\to 1} g(x)}'],
	['11.8.6', '"LIM%X $O #4^-"] F(X)', '\\lim_{x \\to 4^{-}} f(x)'],
	// 11.7: sigma with limits directly under and over
	['11.7.3', '".,S%N .K #1<9]5N', '\\sum_{n = 1}^{9}5n'],
	['11.7.7', '#2".,S%R .K #1<3]3R', '2\\sum_{r = 1}^{3}3r'],
	['11.7.8', '".,S%K .K #1<30](4K+6)', '\\sum_{k = 1}^{30}(4k+6)'],
	// 11.9: integrals, limits directly under and over
	['11.9.5', '"!%1<,=]3X^2"DX', '\\int\\limits_{1}^{\\infty}3x^{2}dx'],
	['11.9.6', '#5"!%A<B]F(X)DX', '5\\int\\limits_{a}^{b}f(x)dx'],
	// 11.9: integrals, limits as scripts
	['11.9.7', '!;0^2"F(X)DX', '\\int_{0}^{2}f(x)dx'],
	// 10.2: logic
	['10.2.5', '@:P@%@:Q', '\\neg p\\wedge\\neg q'],
	['10.2.6', '@:(P@+Q)', '\\neg (p\\vee q)'],
	['10.2.7', 'P $33O Q', 'p \\rightarrow q'],
	// 5.2, 11.3, 11.4: ray, line, vector and arc modifiers
	['5.2.2', '",A,B<$O]', '\\overrightarrow{AB}'],
	['5.2.3', '",A,B<$[33O]', '\\overleftrightarrow{AB}'],
	['11.3.1', '"N<33@O]', '\\vec{n}'],
	['11.3.2', '"N<33@O]+"U<33@O]', '\\vec{n}+\\vec{u}'],
	['11.4.1', '",A,B<$A]', '\\overset{\\frown}{AB}'],
	// 4.2, 4.5, 9.1: shapes and set notation
	['4.5.3', '$[ #1', '\\angle 1'],
	['4.5.10', '$[ #1+$[ #2', '\\angle 1+\\angle 2'],
	['4.2.4', '#2+6 .K $4', '2+6 = \\square'],
	['9.1.4', '#3 /@E ,A', '3 \\notin A']
];

for (const [ref, braille, latex, regenerated = braille] of LESSON_CASES) {
	test(`nemeth.aphtech.org ${ref}: ${braille}`, () => {
		const read = nemethToLatexDetailed(braille);
		assert.deepEqual(read.warnings, [], 'no unrecognized cells');
		assert.equal(read.latex, latex);
		assert.equal(latexToNemeth(latex).trim().toUpperCase(), regenerated);
	});
}

// 11.7 ex 1-2 print a sigma with limits but no body, and the page gives no terminator.
test('nemeth.aphtech.org 11.7.1-2: a limit terminator missing at the end of the line is accepted', () => {
	for (const [braille, latex] of [
		['".,S%N .K #1', '\\sum_{n = 1}'],
		['".,S%N .K #1<9', '\\sum_{n = 1}^{9}']
	]) {
		const read = nemethToLatexDetailed(braille);
		assert.deepEqual(read.warnings, []);
		assert.equal(read.latex, latex);
	}
});

// \limits / \nolimits choose between the stacked form and scripts.
test('\\limits and \\nolimits select the stacked or script form of big operators', () => {
	assert.equal(latexToNemeth('\\int\\limits_a^b f(x)dx').toUpperCase(), '"!%A<B]F(X)DX');
	assert.equal(latexToNemeth('\\int_a^b f(x)dx').toUpperCase(), '!;A^B"F(X)DX');
	assert.equal(latexToNemeth('\\sum\\nolimits_{n=1}^{9} a').toUpperCase(), '.,S;N .K #1^9"A');
});
