import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nemethToLatexDetailed } from '../src/nemeth/toLatex.js';

// Each case is [nemeth ASCII braille, expected LaTeX]. Braille inputs for the structural
// cases are taken from worked examples in the BANA 2022 Nemeth Code (rule/example numbers
// in the comments); expected LaTeX is the print form those examples describe.
const cases = [
	// 11.9 ex 5-6: integral with limits directly under and over; ex 7: limits as scripts
	['"!%1<,=]3X^2"DX', '\\int\\limits_{1}^{\\infty}3x^{2}dx'],
	['#5"!%A<B]F(X)DX', '5\\int\\limits_{a}^{b}f(x)dx'],
	['!;0^2"F(X)DX', '\\int_{0}^{2}f(x)dx'],
	['".,S%N .K #1<,=]A;N', '\\sum_{n = 1}^{\\infty}a_{n}'],
	// Rule 3: numerals, numeric indicator, decimals, numeric comma
	['#3+4', '3+4'],
	['#6.696', '6.696'],
	['#10,000', '10{,}000'],
	// 14.6 numeric subscript: no indicator needed
	['x1', 'x_{1}'],
	['x11', 'x_{11}'],
	// 14.8.1 (ex 14-64/65): level indicators are absolute, baseline returns explicitly
	['x^2"+1', 'x^{2}+1'],
	['x;a"+y^2', 'x_{a}+y^{2}'],
	// ex 14-66: superscript with superscript inside a simple fraction
	['?e^x^^2"/2#', '\\frac{e^{x^{2}}}{2}'],
	// ex 14-95/96: radical at a script level; terminator at the same level
	['>x^2"+y^2"]', '\\sqrt{x^{2}+y^{2}}'],
	['e^>x^^2^+y^^2^]', 'e^{\\sqrt{x^{2}+y^{2}}}'],
	// ex 14-97
	['?1/x^2"#', '\\frac{1}{x^{2}}'],
	// ex 14-98: complex fraction containing simple fractions
	[',?d(?x/y#),/1+(?x/y#)^2",#', '\\frac{d(\\frac{x}{y})}{1+(\\frac{x}{y})^{2}}'],
	// ex 14-101 / 19-9: grouping
	['(x^2"+y^2")(x-y)', '(x^{2}+y^{2})(x-y)'],
	// ex 14-71: contracted comma at subscript level preserves the level
	['x;i[j', 'x_{i,j}'],
	// ex 14-69: comma returns to baseline
	['x^2, x^3', 'x^{2}, x^{3}'],
	// ex 14-99: multipurpose indicator + modifier + termination
	['"x^2"<:]', '\\overline{x^{2}}'],
	['x<:]', '\\overline{x}'],
	// 15.2.2 contracted bar: a letter or numeral followed directly by `:`
	['x:', '\\overline{x}'], // ex 15-9
	['x:+y:', '\\overline{x}+\\overline{y}'], // ex 15-10
	['x:y', '\\overline{x}y'], // ex 15-11
	['#3.54:', '\\overline{3.54}'], // ex 15-18
	['x%:', '\\underline{x}'], // 15.2.3
	['#2sin x', '2\\sin x'], // ex 3-15/18-17: function name right after a numeral
	// 16.2 index of radical
	['<3>x]', '\\sqrt[3]{x}'],
	// 16.3 nested radical (first inner radical indicator is a dot)
	['>1+.>x.]]', '\\sqrt{1+\\sqrt{x}}'],
	// Rule 21: `.k` is "=" only when space-delimited, otherwise Greek kappa
	['a .k b', 'a = b'],
	['a.kb', 'a\\kappa b'],
	// 21.9-21.11 compound comparison signs not listed as single symbols
	['a $o$[33 b', 'a \\overset{\\to}{\\leftarrow} b'], // stacked arrows
	['a "k".k b', 'a <\\;= b'], // horizontal run joined by the multipurpose indicator
	['a "k".k".1 b', 'a <\\;=\\;> b'], // ex 21.11 (less, equals, greater)
	['a $o: b', 'a \\underline{\\to} b'], // bar underneath
	['a @e.k b', 'a \\underset{=}{\\in} b'], // equals sign underneath
	['a "k: b', 'a \\leq b'], // listed combination still matches as one symbol
	// Rule 6: Greek, capitals, German, English-letter indicator
	['.a+.b', '\\alpha+\\beta'],
	['.,g', '\\Gamma'],
	[';a', 'a'],
	[',a', 'A'],
	['_a', '\\mathfrak{a}'],
	// Rule 7 typeforms (ex 7-1..7-5): typeform indicator always followed by alphabet indicator
	['.;t', '\\mathit{t}'],
	['_;j', '\\mathbf{j}'],
	['@;,a', '\\mathcal{A}'],
	[',.;h', '\\mathsf{h}'],
	[',_;,r', '\\mathbb{R}'],
	['_.a', '\\mathbf{\\alpha}'],
	['_#345', '\\mathbf{345}'],
	// Rule 18 function names; Rule 20 operators
	['sin x', '\\sin x'],
	['x@*y', 'x\\times y'],
	['a./b', 'a\\div b'],
	['x*y', 'x\\cdot y'],
	['a+-b', 'a\\pm b'],
	// Rule 23 integral with limits
	['!;0^1"x', '\\int_{0}^{1}x'],
	// 14.5 left scripts: a script with no base to its left attaches to the NEXT symbol
	['^x"n', '{}^{x}n'], // ex 14-23
	['^-"x', '{}^{-}x'], // ex 14-24
	[';x"n', '{}_{x}n'], // ex 14-25
	[';x"n;y', '{}_{x}n_{y}'], // ex 14-26
	['#10^^-^4', '10^{{}^{-}4}'], // ex 14-27
	['^n^;a"x', '{}^{n_{a}}x'], // ex 14-28
	['p;b"^c"x', 'p_{b}{}^{c}x'], // ex 14-34 (multipurpose indicator separates right/left scripts)
	['p^b";c"x', 'p^{b}{}_{c}x'], // ex 14-35
	// 15.6 binomial coefficient
	['(n%k)', '\\binom{n}{k}'], // ex 15-43
	['(g;j"%a;j")', '\\binom{g_{j}}{a_{j}}'], // ex 15-44
	// 21.1 negation: `/` before any comparison sign
	['a /.k b', 'a \\neq b'],
	['a /"k b', 'a \\nless b'],
	['a /@e b', 'a \\notin b'],
	['a /$l b', 'a \\nparallel b'],
	['a /.1.k b', 'a \\not\\geqq b'],
	// comparison signs that begin with the multipurpose cell must still be recognized
	['a "k: b', 'a \\leq b'],
	['a "k b', 'a < b'],
	['a "1 b', 'a : b'],
	// Rule 22 arrows (contracted and double-shafted)
	['a $o b', 'a \\to b'],
	['a $77o b', 'a \\Rightarrow b'],
	['a ${77o b', 'a \\Leftrightarrow b'],
	['a $333o b', 'a \\longrightarrow b'],
	// 19.6 enlarged grouping
	[',(a+b,)', '\\bigl(a+b\\bigr)'],
	// Rule 23 dagger (key must survive alias folding of `}` to `]`)
	['_]', '\\dagger'],
	// Rule 17 shapes
	['$t,a,b,c', '\\triangle ABC'],
	['${.r]', '\\llcorner'],
	['$c_$*]', '\\odot'],
	// 15.2 modifiers: multi-symbol expression uses `"` ... `<mod]`
	['"x+y<:]', '\\overline{x+y}'],
	['x<$33o]', '\\overrightarrow{x}'],
	['x<_<]', '\\hat{x}'],
	['x<*]', '\\dot{x}'],
	['x<@:]', '\\tilde{x}'],
	['x%:]', '\\underline{x}'],
	// Rule 23 partial derivative, factorial, infinity
	['?@d f/@d x#', '\\frac{\\partial f}{\\partial x}'],
	['n&', 'n!'],
	['!!;d', '\\iint_{d}'],
	// Rule 19 grouping variety (ex 19-12 uses a square bracket then a parenthesis)
	['@(a, +,=)', '[a, +\\infty)']
];

for (const [braille, expected] of cases) {
	test(`nemeth ${JSON.stringify(braille)} -> ${expected}`, () => {
		const { latex, warnings } = nemethToLatexDetailed(braille);
		assert.equal(latex, expected);
		assert.deepEqual(warnings, []);
	});
}

test('unknown cells are reported as warnings, never silently dropped', () => {
	const { latex, warnings } = nemethToLatexDetailed('x\x01y');
	assert.ok(warnings.length > 0);
	assert.match(latex, /x/);
	assert.match(latex, /y/);
	assert.match(latex, /\\text\{\[U\+0001\]\}/, 'raw cell must not be embedded in the LaTeX');
});

test('unknown TeX-special cells are not injected into the LaTeX', () => {
	assert.doesNotMatch(nemethToLatexDetailed('x\x7fy').latex, /\x7f/);
});

test('uppercase, backtick and tilde aliases normalize like their canonical cells', () => {
	assert.equal(nemethToLatexDetailed('X~2').latex, 'x^{2}');
	assert.equal(nemethToLatexDetailed('`(A`)').latex, '[a]');
});
