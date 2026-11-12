import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { wrapLatexDocument, escapeLatexText } from '../src/index.js';

test('wrapLatexDocument() emits the tagged-PDF/UA-2 preamble, with \\DocumentMetadata before \\documentclass', () => {
	const doc = wrapLatexDocument('Hello', { title: 'My Doc', lang: 'en-GB' });
	assert.ok(doc.startsWith('\\DocumentMetadata{'), '\\DocumentMetadata must be the very first thing in the file');
	assert.ok(doc.indexOf('\\DocumentMetadata') < doc.indexOf('\\documentclass'));
	for (const key of ['lang=en-GB', 'pdfversion=2.0', 'pdfstandard=ua-2', 'tagging=on', 'math/setup=mathml-SE']) {
		assert.ok(doc.includes(key), `missing ${key}`);
	}
	assert.match(doc, /\\hypersetup\{pdftitle=\{My Doc\}\}/);
	assert.match(doc, /\\begin\{document\}\nHello\n\\end\{document\}/);
});

test('wrapLatexDocument() { accessible: false } gives the legacy preamble with no tagging keys', () => {
	const doc = wrapLatexDocument('Hello', { accessible: false });
	assert.doesNotMatch(doc, /DocumentMetadata|hyperref|tagging/);
	assert.match(doc, /\\documentclass\[fleqn\]\{article\}/);
});

test('wrapLatexDocument() escapes the title/author and ignores a malformed language tag', () => {
	const doc = wrapLatexDocument('x', { title: 'Q&A: 50% {off} $5', author: 'A_B', lang: 'en},evil={' });
	assert.match(doc, /pdftitle=\{Q\\&A: 50\\% \\\{off\\\} \\\$5\}/);
	assert.match(doc, /pdfauthor=\{A\\_B\}/);
	assert.match(doc, /lang=en-US,/, 'invalid lang must fall back to the default, not be pasted into the preamble');
	assert.equal(escapeLatexText('a\nb\\c'), 'a b\\textbackslash{}c');
});

test('wrapLatexDocument() defaults the title (PDF/UA requires one) and comments out an error body', () => {
	assert.match(wrapLatexDocument(''), /pdftitle=\{Untitled document\}/);
	assert.match(wrapLatexDocument(''), /% Empty document/);
	assert.match(wrapLatexDocument('Error: boom'), /\n% Error: boom\n/);
});

test('CLI --full-doc LaTeX uses the shared accessible template, titled from the file name; --no-tagging opts out', () => {
	const dir = mkdtempSync(path.join(tmpdir(), 'bb-fulldoc-'));
	try {
		const file = path.join(dir, 'Lab Report.brf');
		writeFileSync(file, 'HELLO\n');
		const cli = path.join(import.meta.dirname, '../bin/braille-bridge.js');
		const tagged = execFileSync('node', [cli, file, '--braille-only', '--full-doc'], { encoding: 'utf8' });
		assert.match(tagged, /tagging=on/);
		assert.match(tagged, /pdftitle=\{Lab Report\}/);
		const legacy = execFileSync('node', [cli, file, '--braille-only', '--full-doc', '--no-tagging'], { encoding: 'utf8' });
		assert.doesNotMatch(legacy, /tagging=on/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

// The real check: the preamble is only useful if it compiles. Skips when no TeX
// install is available (e.g. CI); locally, covers both engines. Needs TeX Live 2025+.
for (const engine of ['pdflatex', 'lualatex']) {
	const available = spawnSync(engine, ['--version'], { encoding: 'utf8' }).status === 0;
	test(`accessible template compiles to a tagged PDF 2.0 with ${engine}`, { skip: !available && `${engine} not installed` }, () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'bb-tex-'));
		try {
			writeFileSync(
				path.join(dir, 'doc.tex'),
				// The math forms braille-bridge itself emits: inline $...$ and display $$...$$.
				wrapLatexDocument('Text $\\ 100mgm^{-2}yr^{-1\\ }$ more, \\textbf{bold}.\n\n$$\\ a+b\\ $$\n', { title: 'Compile test' })
			);
			const run = () => spawnSync(engine, ['-interaction=nonstopmode', '-halt-on-error', 'doc.tex'], { cwd: dir, encoding: 'utf8' });
			run();
			const result = run(); // second pass settles cross-references
			assert.equal(result.status, 0, result.stdout.slice(-1500));
			const pdf = readFileSync(path.join(dir, 'doc.pdf'));
			assert.equal(pdf.subarray(0, 8).toString('latin1'), '%PDF-2.0');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
}

// ---- long equations (`longEquations` option) ----

const LONG_EQ = 'a_1' + Array.from({ length: 40 }, (_, i) => `+a_{${i + 2}}`).join('') + ' = b';
const BODY_WITH_DISPLAYS = `Cost is \\$5. Inline $x$ stays.\n\n$$${LONG_EQ}$$\n$$\\frac{e^{x^{2}}}{2}+\\sqrt{x^{2}+y^{2}}+\\binom{n}{k}+\\overline{x+y}$$\n\n$$\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}$$\n`;

test('longEquations is on by default: displays become breakable inline math, nothing else is touched', () => {
	const doc = wrapLatexDocument(BODY_WITH_DISPLAYS);
	assert.match(doc, /tagging=on/);
	assert.equal((doc.match(/\\noindent\$\\displaystyle /g) || []).length, 3);
	assert.doesNotMatch(doc, /\$\$|breqn|dmath/);
	assert.ok(doc.includes('Cost is \\$5. Inline $x$ stays.'), 'inline math and escaped \\$ must be left alone');
});

test('display content is not trimmed: a trailing control space `\\ ` must not become an escaped dollar `\\$`', () => {
	const doc = wrapLatexDocument('$$\\ a+b\\ $$');
	assert.ok(doc.includes('\\displaystyle \\ a+b\\ $'), doc);
	assert.doesNotMatch(doc, /\\\$\\par/);
});

test("longEquations: 'none' (or false) keeps $$...$$ untouched", () => {
	for (const longEquations of ['none', false]) {
		assert.ok(wrapLatexDocument(BODY_WITH_DISPLAYS, { longEquations }).includes(`$$${LONG_EQ}$$`));
	}
});

test('an empty display is left alone, and an unrecognized value falls back to the default', () => {
	assert.ok(wrapLatexDocument('$$  $$').includes('$$  $$'));
	assert.match(wrapLatexDocument('$$a$$', { longEquations: 'evil}' }), /\\displaystyle a\$/);
});

// Real compiles. A long display must neither fail to compile nor overflow the line, with and
// without tagging (breqn cannot do the former, which is why it is not used). Skips when TeX
// is unavailable.
for (const engine of ['pdflatex', 'lualatex']) {
	const available = spawnSync(engine, ['--version'], { encoding: 'utf8' }).status === 0;
	const configs = [
		{ name: 'tagged PDF/UA (default)', opts: {} },
		{ name: 'legacy preamble (accessible: false)', opts: { accessible: false } }
	];
	for (const cfg of configs) {
		test(`long equations compile without overflow: ${cfg.name} (${engine})`, { skip: !available && `${engine} not installed` }, () => {
			const dir = mkdtempSync(path.join(tmpdir(), 'bb-tex-'));
			try {
				const doc = wrapLatexDocument(BODY_WITH_DISPLAYS, { title: 'Long', ...cfg.opts });
				writeFileSync(path.join(dir, 'doc.tex'), doc);
				const result = spawnSync(engine, ['-interaction=nonstopmode', '-halt-on-error', 'doc.tex'], { cwd: dir, encoding: 'utf8' });
				assert.equal(result.status, 0, result.stdout.slice(-1500));
				assert.doesNotMatch(result.stdout, /Overfull \\hbox/, 'a long equation overflowed the line');
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		});
	}
	test(`control: the same long display with longEquations 'none' DOES overflow (${engine})`, { skip: !available && `${engine} not installed` }, () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'bb-tex-'));
		try {
			writeFileSync(path.join(dir, 'doc.tex'), wrapLatexDocument(BODY_WITH_DISPLAYS, { accessible: false, longEquations: 'none' }));
			const result = spawnSync(engine, ['-interaction=nonstopmode', '-halt-on-error', 'doc.tex'], { cwd: dir, encoding: 'utf8' });
			assert.match(result.stdout, /Overfull \\hbox/, 'if this stops overflowing, the tests above no longer prove anything');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
}

test('CLI breaks long equations by default and --no-break-equations keeps $$...$$', () => {
	const dir = mkdtempSync(path.join(tmpdir(), 'bb-cli-'));
	try {
		const file = path.join(dir, 'e.brf');
		writeFileSync(file, '_%X^2"+Y\n_:\n_%A+B\n_:\n');
		const cli = path.join(import.meta.dirname, '../bin/braille-bridge.js');
		const run = (...a) => execFileSync('node', [cli, file, '--braille-only', '--full-doc', ...a], { encoding: 'utf8' });
		for (const extra of [[], ['--no-tagging']]) {
			const broken = run(...extra);
			assert.match(broken, /\\noindent\$\\displaystyle /);
			assert.doesNotMatch(broken, /\$\$/);
			const plain = run('--no-break-equations', ...extra);
			assert.match(plain, /\$\$/);
			assert.doesNotMatch(plain, /displaystyle/);
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
