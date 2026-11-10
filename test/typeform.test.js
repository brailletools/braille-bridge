import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lex, DualDocument } from '../src/index.js';

// Real UEB typeform indicator coverage: bold=dots-45 ("^"), italic=dots-46 ("."),
// underline=dots-456 ("_"), each with symbol/word/passage scope suffixes
// ("2"/"1"/"7"..."'"). Verified against the actual dot patterns via
// braille2Ascii() -- see processFile.js's TYPEFORM_PREFIX/SCOPE_SUFFIX doc
// comment. Identity translate, matching document.test.js's convention -- these
// test parsing/rendering mechanics, not real braille orthography.
const identityTranslate = async (unicodeBraille) => unicodeBraille;
const identityTranslateForward = async (text) => text;

function makeDoc(text) {
	return DualDocument.fromBraille(text, {
		translate: identityTranslate,
		translateForward: identityTranslateForward
	});
}

test('symbol scope wraps exactly one character, even mid-word, for all three typeforms', () => {
	const cases = [
		{ text: 'big^2Ddog', span: 'BOLD', char: 'D' },
		{ text: 'big.2Ddog', span: 'ITALIC', char: 'D' },
		{ text: 'big_2Ddog', span: 'UNDERLINE', char: 'D' }
	];
	for (const { text, span, char } of cases) {
		const tree = lex(text);
		const para = tree.children[0];
		assert.equal(para.children.length, 3, `${text}: STRING("big"), ${span}("${char}"), STRING("dog")`);
		assert.equal(para.children[0].token, 'STRING');
		assert.equal(para.children[0].value, 'big');
		assert.equal(para.children[1].token, span);
		assert.equal(para.children[1].value, char);
		assert.equal(para.children[2].token, 'STRING');
		assert.equal(para.children[2].value, 'dog');
	}
});

test('word scope auto-closes at the end of the current word, for all three typeforms', () => {
	const cases = [
		{ text: '^1BOLD next', span: 'BOLD' },
		{ text: '.1ITALIC next', span: 'ITALIC' },
		{ text: '_1UNDERLINE next', span: 'UNDERLINE' }
	];
	for (const { text, span } of cases) {
		const tree = lex(text);
		const para = tree.children[0];
		assert.equal(para.children.length, 2);
		assert.equal(para.children[0].token, span);
		assert.equal(para.children[1].token, 'STRING');
		// Leading space: the separator between the word-scope span and "next" is
		// flushed onto the new STRING node that receives it (see lex()'s pendingSpace
		// handling) rather than appended inside the closing span.
		assert.equal(para.children[1].value, ' next');
	}
});

test('typeform markers are NOT recognized inside NEMETH content -- "^2" there is a real exponent, not a bold-symbol marker', async () => {
	// Nemeth math ASCII notation legitimately produces "^2" for an exponent (e.g.
	// latex_to_nemeth('a^2 + b^2 = c^2') really does emit literal "A^2"/"B^2"/"C^2"),
	// which collides with the bold-symbol marker's own ASCII form. Both the
	// NEMETH-content loop and the word-based loop (which also scans a NEMETH
	// block's content when it opens mid-word) must treat "^"/"."/"_" literally
	// while inside NEMETH.
	const tree = lex('_%A^2+B^2 .K C^2_:');
	const para = tree.children[0];
	assert.equal(para.token, 'EQUATION', 'a paragraph that is only math is promoted to EQUATION');
	const nemeth = para.children.find((c) => c.token === 'NEMETH');
	assert.ok(nemeth, 'expected a NEMETH child');
	assert.equal(nemeth.children.length, 0, 'no BOLD/ITALIC/UNDERLINE nodes should be carved out of the math');
	assert.equal(nemeth.value, 'A^2+B^2 .K C^2', 'the exponent markers must survive as literal Nemeth ASCII');

	const latex = await tree.to_latex('en-ueb-g2.ctb', identityTranslate);
	assert.doesNotMatch(latex, /\\textbf|\\textit|\\underline/, 'no typeform markup should appear inside the equation');
});

test('passage scope is an explicit open/close pair spanning multiple words, keyed per typeform', () => {
	// A stray close of a DIFFERENT typeform (here, an italic passage-close with no
	// matching italic passage-open) must not close the enclosing BOLD passage --
	// it's a no-op, silently consumed like any other stray close marker (see
	// applyMarker()'s 'close' case; same behavior already covered for a stray
	// NEMETHSTOP/BOLD-close elsewhere).
	const tree = lex("^7one two.'not the end^' after");
	const para = tree.children[0];
	const bold = para.children.find((c) => c.token === 'BOLD');
	assert.ok(bold, 'expected a BOLD passage span');
	assert.equal(bold.value, 'one twonot the end');
	assert.equal(para.children[para.children.length - 1].token, 'STRING');
	assert.equal(para.children[para.children.length - 1].value, ' after');
});

test('UNDERLINE renders as \\underline{} in LaTeX and Pandoc bracketed-span syntax in Markdown', async () => {
	const tree = lex('_1WORD plain');
	const latex = await tree.to_latex('en-ueb-g2.ctb', identityTranslate);
	assert.match(latex, /\\underline\{[^}]*\}/);

	const markdown = await tree.to_markdown('en-ueb-g2.ctb', identityTranslate);
	assert.match(markdown, /\[[^\]]*\]\{\.underline\}/);
});

test('fromMarkdown() recognizes [text]{.underline} and round-trips it to a passage-scope UNDERLINE marker', async () => {
	const doc = await DualDocument.fromMarkdown('plain [underlined]{.underline} text', {
		translate: identityTranslate,
		translateForward: identityTranslateForward
	});
	const [para] = doc.topLevelNodes;
	const tokenTypes = para.children.map((c) => c.token);
	assert.ok(tokenTypes.includes('UNDERLINE'));
	assert.match(doc.brailleText, /_7[^_]*_'/, 'underline should be wrapped in braille passage-scope markers');
});

test('editing \\underline{}/[]{.underline} markup from the LaTeX/Markdown pane degrades safely to plain text, like bold/italic already do', async () => {
	const latexDoc = await makeDoc('_1WORD plain');
	const oldLatex = latexDoc.latexText;
	assert.match(oldLatex, /\\underline\{[^}]*\}/, 'sanity check: this fixture renders as underlined LaTeX');
	const newLatex = oldLatex + ' more';
	const result = await latexDoc.applyLatexEdit(newLatex, newLatex.length);
	assert.equal(result.nodeError, null);
	assert.equal(latexDoc.errors.length, 0);

	const mdDoc = await makeDoc('_1WORD plain');
	await mdDoc.renderMarkdown();
	const oldMarkdown = mdDoc.markdownText;
	assert.match(oldMarkdown, /\[[^\]]*\]\{\.underline\}/, 'sanity check: this fixture renders with a Markdown underline span');
	const newMarkdown = oldMarkdown + ' more';
	const mdResult = await mdDoc.applyMarkdownEdit(newMarkdown, newMarkdown.length);
	assert.equal(mdResult.nodeError, null);
	assert.equal(mdDoc.errors.length, 0);
});
