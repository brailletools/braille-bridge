// Wraps converted LaTeX body text in a complete, compilable document.
//
// This is the single source of truth for the document template -- the CLI's
// --full-doc and the web editor's "download LaTeX" both use it, so they can't
// drift apart (they previously each had their own, different preamble).
//
// By default the preamble requests a *tagged, PDF/UA-2* PDF, the current LaTeX
// route to an accessible PDF (screen readers need the structure tree, document
// language and title, and math exposed as MathML rather than as flat glyphs):
//
//   \DocumentMetadata{...}   must be the very first thing in the file, before
//                            \documentclass. `tagging=on` is what actually builds
//                            the structure tree -- `pdfstandard=ua-2` alone only
//                            *claims* conformance in the metadata. UA-2 needs PDF
//                            2.0, hence `pdfversion=2.0`. `math/setup=mathml-SE`
//                            exposes each formula as MathML structure elements.
//   hyperref + pdftitle      a PDF/UA document must have a title, shown in the
//                            window title bar (DisplayDocTitle) -- no visible
//                            \maketitle is added, so the page content is unchanged.
//
// Requires TeX Live / MiKTeX 2025 or later (the tagging keys don't exist in older
// kernels -- on those, \DocumentMetadata errors out; pass { accessible: false } for
// the legacy preamble). Verified to compile cleanly with both pdflatex and lualatex
// on TeX Live 2026, including Nemeth-derived math, fleqn and \mathindent. Note this
// produces the tags; it doesn't *validate* the PDF -- run it through veraPDF or
// PAC before claiming conformance.
//
// Known limitation (checked on TeX Live 2026): under lualatex with tagging on, a
// hand-written \begin{equation} combined with the fleqn class option dies with a
// LuaTeX "(nodes): trying to delete an attribute reference" error. pdflatex is fine
// with it, and so is everything braille-bridge itself emits ($...$, $$...$$, and
// \textbf/\textit) on both engines -- so if a user adds an equation environment
// to the LaTeX pane and compiles with lualatex, switch engines or drop fleqn.

//
// Long equations (the `longEquations` option, on by default). Braille equations have unknown
// length, and a plain `$$...$$` display never breaks: a long one runs off the page (verified
// on TeX Live 2026 with pdflatex and lualatex). So each display is rewritten to a paragraph
// holding `$\displaystyle ...$`: TeX breaks inline math after binary operators and relations
// by itself, and this works with the tagged PDF/UA preamble. (breqn's dmath* has nicer
// layout but cannot be used: with any `tagging=on` it fails with "File ended while scanning
// use of \__math_grab_dollar_delim:w", on both engines.) Pass `longEquations: 'none'` to
// keep `$$...$$`; the web editor's HTML preview does, because latex.js can't parse the
// rewritten form.

const DEFAULT_LANG = 'en-US';
// BCP 47-ish: "en", "en-US", "zh-Hant-TW". The value is pasted into
// \DocumentMetadata, so anything that doesn't look like a language tag is ignored
// rather than escaped.
const LANG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

const LATEX_SPECIALS = {
	'\\': '\\textbackslash{}',
	'{': '\\{',
	'}': '\\}',
	$: '\\$',
	'&': '\\&',
	'#': '\\#',
	'^': '\\textasciicircum{}',
	_: '\\_',
	'~': '\\textasciitilde{}',
	'%': '\\%'
};

// `$$...$$` that is not an escaped `\$` pair; non-greedy so adjacent displays stay separate.
const DISPLAY_MATH_RE = /(?<!\\)\$\$([\s\S]*?)(?<!\\)\$\$/g;

/** Rewrite `$$...$$` displays as breakable inline math paragraphs. */
function breakLongEquations(body) {
	return body.replace(DISPLAY_MATH_RE, (whole, inner) =>
		inner.trim() === '' ? whole : `\\par\\smallskip\\noindent$\\displaystyle ${inner}$\\par\\smallskip` // not trimmed: `\\ ` at the end is a control space, and trimming it would leave `\\$`
	);
}

/**
 * Escapes text for safe use inside a LaTeX argument (e.g. the document title).
 * @param {string} text
 */
export function escapeLatexText(text) {
	return String(text ?? '')
		.replace(/[\r\n]+/g, ' ')
		.replace(/[\\{}$&#^_~%]/g, (ch) => LATEX_SPECIALS[ch]);
}

/**
 * @param {string} content LaTeX body (output of renderLatex()/to_latex())
 * @param {object} [options]
 * @param {string} [options.title]  PDF document title (required by PDF/UA). Default "Untitled document".
 * @param {string} [options.author] PDF author metadata; omitted when empty.
 * @param {string} [options.lang]   Document language tag. Default "en-US".
 * @param {'wrap'|'none'|boolean} [options.longEquations='wrap'] Wrap long `$$...$$` equations (break
 *   across lines; see the note above the constants). `'none'` / `false` keeps `$$...$$`.
 * @param {boolean} [options.accessible=true] Emit the tagged-PDF/UA-2 preamble. Set false for
 *   the legacy preamble if the document must compile on a TeX distribution older than 2025.
 * @returns {string} A complete LaTeX document
 */
export function wrapLatexDocument(content, { title, author, lang, accessible = true, longEquations = 'wrap' } = {}) {
	const breakEquations = longEquations !== 'none' && longEquations !== false;
	const body = (content ?? '').trim();
	// If the body is an error message, comment it out to avoid compilation failure
	const safeBody = body.startsWith('Error')
		? `% ${body}`
		: breakEquations
			? breakLongEquations(body)
			: body;

	const language = lang && LANG_RE.test(lang) ? lang : DEFAULT_LANG;
	const pdfTitle = escapeLatexText(title?.trim() || 'Untitled document');
	const pdfAuthor = escapeLatexText(author?.trim() || '');

	const preamble = accessible
		? [
				'\\DocumentMetadata{',
				`  lang=${language},`,
				'  pdfversion=2.0,',
				'  pdfstandard=ua-2,',
				'  tagging=on,',
				'  tagging-setup={math/setup=mathml-SE}',
				'}',
				'\\documentclass[fleqn]{article}',
				'\\usepackage{amsmath}',
				'\\usepackage{amssymb}',
				'\\usepackage{hyperref}',
				`\\hypersetup{pdftitle={${pdfTitle}}${pdfAuthor ? `,pdfauthor={${pdfAuthor}}` : ''}}`
			]
		: [
				'\\documentclass[fleqn]{article}',
				'\\usepackage[utf8]{inputenc}',
				'\\usepackage{amsmath}',
				'\\usepackage{amssymb}'
			];

	return [
		...preamble,
		'% Remove left indentation for display math to fully left-justify',
		'\\setlength{\\mathindent}{0pt}',
		'\\begin{document}',
		safeBody || '% Empty document',
		'\\end{document}',
		''
	].join('\n');
}
