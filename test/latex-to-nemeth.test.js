import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latex_to_nemeth as toBrf, nemeth_to_latex } from '../src/index.js';

// The spec writes letters in lowercase; the API returns uppercase (BRF convention).
const latex_to_nemeth = (l) => toBrf(l).toLowerCase();

// [LaTeX, expected Nemeth ASCII braille]. Expected braille comes from worked examples
// in the BANA 2022 Nemeth Code (example numbers in comments), or from applying the
// numbered rule directly where the code gives a rule rather than an example.
const cases = [
	// 14.8 level indicators are absolute; baseline return before a following operator
	['x^2+1', 'x^2"+1'], // ex 14-64
	['x_a+y^2', 'x;a"+y^2'], // ex 14-65
	['\\frac{e^{x^2}}{2}', '?e^x^^2"/2#'], // ex 14-66
	['\\sqrt{x^2+y^2}', '>x^2"+y^2"]'], // ex 14-95
	['e^{\\sqrt{x^2+y^2}}', 'e^>x^^2^+y^^2^]'], // ex 14-96: terminator at the radical's own level
	['\\frac{1}{x^2}', '?1/x^2"#'], // ex 14-97
	['(x^2+y^2)(x-y)', '(x^2"+y^2")(x-y)'], // ex 19-9
	// 14.6 / 14.10.1 numeric subscripts: no indicator, no baseline return
	['(x_1+1)', '(x1+1)'], // ex 14-116
	['(x_1y_1+x_2y_2)', '(x1y1+x2y2)'], // ex 14-117
	// 14.11 simultaneous scripts: subscript first
	['x_a^n', 'x;a^n'], // ex 14-121
	['x_1^2', 'x1^2'], // ex 14-123
	// 14.8.2 comma: contracted at a script level, ordinary at baseline
	['x_{i,j}', 'x;i[j'], // ex 14-71
	['x^2, x^3', 'x^2, x^3'], // ex 14-69
	// 14.5 left scripts
	['{}^{x}n', '^x"n'], // ex 14-23
	['{}_{x}n', ';x"n'], // ex 14-25
	['{}_{x}n_{y}', ';x"n;y'], // ex 14-26
	// 13 fractions
	['\\frac{3}{8}', '?3/8#'],
	['\\frac{\\frac{3}{8}}{5}', ',??3/8#,/5,#'], // ex 13-23 (as drawn: complex fraction)
	['\\frac{x}{\\frac{1}{2}}', ',?x,/?1/2#,#'],
	['1\\frac{1}{2}', '#1_?1/2_#'], // 13.4 mixed number
	['1/3', '#1_/3'], // ex 13-10 slash with numerator/denominator on the same level
	// 15 modifiers
	['\\overline{x}', 'x:'], // ex 15-9 contracted form
	['\\overline{x}+\\overline{y}', 'x:+y:'], // ex 15-10
	['\\overline{x+y}', '"x+y<:]'], // ex 15-2
	['\\overline{x^2}', '"x^2"<:]'], // ex 15-4
	['\\overline{AB}', '",a,b<:]'], // ex 15-1
	['\\hat{x}', '"x<_<]'],
	['\\lim_{x\\to 0} f(x)', '"lim%x $o #0] f(x)'], // ex 15-3 / 18-11
	['\\sum_{n=0}^{\\infty} a_n', '".,s%n .k #0<,=]a;n'], // ex 21-27
	['\\binom{n}{k}', '(n%k)'], // ex 15-43
	// 11.9 integrals: limits as scripts (ex 7-9) or directly under/over with \limits (ex 5-6)
	['\\int x^2dx', '!x^2"dx'], // ex 1
	['\\int (x^2-2x+4)dx', '!(x^2"-2x+4)dx'], // ex 3
	['\\iint f(x,y)dA', '!!f(x, y)d,a'], // ex 4
	['\\int\\limits_1^\\infty 3x^2dx', '"!%1<,=]3x^2"dx'], // ex 5
	['5\\int\\limits_a^b f(x)dx', '#5"!%a<b]f(x)dx'], // ex 6
	['\\int_0^2 f(x)dx', '!;0^2"f(x)dx'], // ex 7
	['\\int_0^\\infty \\sin x dx', '!;0^,="sin xdx'], // ex 8
	['\\sum\\limits_{n=0}^{\\infty} a_n', '".,s%n .k #0<,=]a;n'],
	// 16 radicals
	['\\sqrt[3]{x}', '<3>x]'],
	['\\sqrt{1+\\sqrt{x}}', '>1+.>x.]]'],
	// 3.3 / 3.4 numeric indicator
	['y = 2\\sin x', 'y .k #2sin x'], // ex 3-15
	['-1', '-#1'], // ex 3-11
	['+3', '+3'], // ex 3-13
	['x-5', 'x-5'], // ex 3-53
	['\\sin 1', 'sin #1'], // ex 3-19
	['30^\\circ', '#30^.*'], // ex 3-18 (without the surrounding list)
	// 6.3 English-letter indicator on single letters, with the 6.4 exemptions
	['x', ';x'], // 6.3.1
	['n, n_1, n_2, s, s_1, s_2', ';n, n1, n2, ;s, s1, s2'], // ex 6-8
	['x = y', 'x .k y'], // 6.4.7: next to a comparison sign
	['ab', 'ab'], // 6.4.1: letter combination
	['(a, b)', '(a, b)'], // 6.4.5: enclosed list
	['\\cos A', 'cos ,a'], // 6.4.2: after a function name
	// 5, 6, 7 alphabets and typeforms
	['\\alpha+\\beta', '.a+.b'],
	['\\Gamma', '.,g'],
	['\\mathbb{R}', ',_;,r'], // ex 7-2
	['\\mathbf{j}', '_;j'], // ex 7-3
	['\\mathcal{A}', '@;,a'], // ex 7-4
	['\\mathsf{h}', ',.;h'], // ex 7-5
	['\\mathbf{\\alpha}', '_.a'], // ex 7-3
	// 18 / 20 / 21 spacing
	['\\sin x+y', 'sin x+y'], // ex 18-14
	['2\\sin x+3\\cos y', '#2sin x+3cos y'], // ex 18-17
	['\\sin x-\\sin y', 'sin x-sin y'], // ex 20-12
	['\\sin^2 x', 'sin^2 x'], // ex 18-8
	['a \\neq b', 'a /.k b'], // ex 21-1
	['a < b', 'a "k b'],
	['a \\leq b', 'a "k: b'],
	['A \\to B', ',a $o ,b'], // ex 21-8
	['a \\in B', 'a @e ,b'],
	['p \\wedge q', 'p@%q'],
	// 21.9-21.11 compound comparison signs
	['a \\overset{\\to}{\\leftarrow} b', 'a $o$[33 b'],
	['a < = > b', 'a "k".k".1 b'],
	['a \\underline{\\to} b', 'a $o: b'],
	['a \\underset{=}{\\in} b', 'a @e.k b'],
	['a \\underline{\\subset} b', 'a _"k: b'],
	// 19 grouping
	['[a,+\\infty)', '@(a, +,=)'], // ex 19-12
	['\\left(a+b\\right)', ',(a+b,)'], // 19.6 enlarged
	// 23 miscellany
	['\\frac{\\partial f}{\\partial x}', '?@df/@dx#'],
	['n!', 'n&'],
	['\\int_0^1 x\\,dx', '!;0^1"x dx'],
	['a\\times b', 'a@*b'],
	['a\\div b', 'a./b'],
	['a\\pm b', 'a+-b']
];

for (const [latex, expected] of cases) {
	test(`latex ${JSON.stringify(latex)} -> ${expected}`, () => {
		assert.equal(latex_to_nemeth(latex), expected);
	});
}

test('matrices become aligned rows in enlarged brackets, with the layout the code prescribes (25.8)', () => {
	assert.equal(
		latex_to_nemeth('\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}'),
		'\n,(#1 #2,)\n,(#3 #4,)\n' // numeric indicator required on matrix entries (25.8.1)
	);
	assert.equal(latex_to_nemeth('\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}'), '\n@,(a b@,)\n@,(c d@,)\n');
});

// The old translator turned these into garbage ("BEGIN MATRIX...", "XIN", "MATHBB ,R").
// Unsupported input must throw so callers leave the braille pane untouched.
for (const bad of ['\\unknowncmd{x}', '\\text{hello}', '\\begin{align}a&=b\\end{align}', '\\frac{1}{2', 'x^']) {
	test(`unsupported or malformed LaTeX throws instead of emitting garbage: ${bad}`, () => {
		assert.throws(() => latex_to_nemeth(bad), /latex_to_nemeth/);
	});
}

test('output uses uppercase letters, the BRF convention', () => {
	assert.equal(toBrf('x^2+y'), 'X^2"+Y');
});

test('empty input returns an empty string', () => {
	assert.equal(latex_to_nemeth('   '), '');
});

// Round trip: the two directions are written independently from the spec's rules, so
// agreement on a corpus is a strong consistency check (and catches asymmetric bugs).
const norm = (s) =>
	s
		.replace(/\\left|\\right|\\bigl|\\bigr|\s+/g, '')
		.replace(/\\,/g, '')
		.replace(/([\^_])\{(\w|\\\w+)\}/g, '$1$2'); // x^{2} and x^2 are the same math
const roundTrip = [
	'x^2+1',
	'x_a+y^2',
	'\\frac{e^{x^2}}{2}',
	'\\sqrt{x^2+y^2}',
	'e^{\\sqrt{x^2+y^2}}',
	'(x^2+y^2)(x-y)',
	'x_{i,j}',
	'\\frac{3}{8}',
	'\\frac{\\frac{3}{8}}{5}',
	'\\overline{x+y}',
	'\\sqrt[3]{x}',
	'\\sqrt{1+\\sqrt{x}}',
	'y=2\\sin x',
	'a\\neq b',
	'a\\leq b',
	'\\binom{n}{k}',
	'\\alpha+\\beta',
	'\\mathbb{R}',
	'n!',
	'a\\times b',
	'\\frac{\\partial f}{\\partial x}',
	'30^{\\circ}',
	'\\overline{x}',
	'a\\overset{\\to}{\\leftarrow}b',
	'a\\underset{=}{\\in}b'
];
for (const latex of roundTrip) {
	test(`round trip LaTeX -> Nemeth -> LaTeX: ${latex}`, () => {
		const back = nemeth_to_latex(latex_to_nemeth(latex));
		assert.equal(norm(back), norm(latex));
	});
}
