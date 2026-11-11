# @brailletools/braille-bridge

JavaScript library and CLI for converting Braille Readiness Format (BRF) files to LaTeX,
Markdown, or (via [Pandoc](https://pandoc.org/)) any other format Pandoc can write —
and for building a live-synced braille⟷LaTeX/Markdown editor (see `DualDocument` below).
Supports Nemeth math notation and UEB text via [liblouis](https://github.com/liblouis/liblouis.js).

## Install

Not yet published to the npm registry. Until then, install directly from GitHub:

```bash
npm install github:brailletools/braille-bridge
```

Once published, the usual form will work:

```bash
npm install @brailletools/braille-bridge
```

`configure()` (browser-side back-translation, see below) needs `liblouis.EasyApiAsync`
loaded as a global via a `<script>` tag; braille-bridge has no npm dependency for that.

This package depends on [`pandoc-wasm`](https://github.com/pandoc/pandoc-wasm) (~56MB
unpacked) for `convertText()`/`convertToBinaryFormat()`/`convertFromBinaryFormat()` and
for the CLI's non-`latex`/`markdown` `--format` values — that's a one-time install-time
disk cost, not a runtime download cost: in Node it reads its wasm binary straight from
disk, and in a browser bundler it's only fetched over the network the first time one of
those functions is actually called (see [`src/pandoc.js`](./src/pandoc.js)'s doc comment —
a bundler that respects lazy `import()` code-splitting, e.g. Vite, will never fetch it for
a consumer that never calls those functions at all).

## API

### `configure({ liblouisCapiUrl, liblouisEasyApiUrl, liblouisTablesUrl? })`

Must be called once before `DualDocument.fromBraille()`/`fromMarkdown()` (or any other
translation in this package that doesn't supply its own `translate`/`translateForward`
override). Provides the URLs to the liblouis WebAssembly build. Requires
`liblouis.EasyApiAsync` to already be available as a global — load the vendored
`easy-api.js` via a `<script>` tag before calling `configure()`; braille-bridge doesn't fetch
or inject that script itself (see [Usage in SvelteKit / browser](#usage-in-sveltekit--browser)
below). `liblouisTablesUrl` is only needed for a "no-tables" build (tables loaded on demand
rather than compiled in).

### `whenReady()`

Resolves once `configure()` has finished setting up the liblouis backend (or rejects if
setup failed). Exposed separately for callers that want to gate UI state (e.g. a loading
indicator) on readiness without triggering a load.

### `lex(text, { linesAreParagraphs? })`

The BRF tokenizer — parses braille (ASCII/NABCC) text into the token
tree `DualDocument` and `Element.to_latex()`/`to_markdown()` operate
on. Exposed for callers who want the parsed token tree directly,
without going through `DualDocument`.

**Paragraphs.** By default a paragraph is ended by a
blank line, so a single newline is just a wrapped line — correct for
hard-wrapped BRFs. Pass `{ linesAreParagraphs: true }` for files where
every line is its own paragraph (e.g. one answer per line): the
separator is then a single newline, so no blank lines are needed to
get paragraph breaks in the LaTeX/Markdown. A blank line becomes an
empty paragraph, which keeps the braille text round-tripping exactly.
The chosen separator is stored on the tree
(`tree.paragraphSeparator`).

**ASCII-braille aliases.** `~` and DEL (`0x7f`) are the same cells as
`^` and `_` (like `a–z` alias `A–Z`), and some BRF writers emit them.
`lex()` treats them as `^`/`_` so Nemeth spans and typeform markers
are recognized either way (a 1-for-1 substitution, so offsets are
unchanged; the lexed tree holds the canonical `^`/`_`). Assumes
standard ASCII braille — not verified against NABCC.

Recognizes two families of inline markers:

- **Nemeth math**: `_%...text..._:` marks an inline or multi-line Nemeth math block.
- **UEB typeform indicators** (bold/italic/underline) — the real Unified English Braille
  scheme, not an ad hoc convention. Each typeform has a one-character prefix (bold `^`,
  italic `.`, underline `_`) and a one-character scope suffix:

  | | single symbol | word | passage begin | passage end (terminator) |
  |---|---|---|---|---|
  | Bold | `^2` | `^1` | `^7` | `^'` |
  | Italic | `.2` | `.1` | `.7` | `.'` |
  | Underline | `_2` | `_1` | `_7` | `_'` |

  **Symbol** scope applies to exactly the next character (e.g. `big^2Ddog` bolds only
  the `D`). **Word** scope applies to the next word and needs no closing marker — it
  auto-closes at the next space (e.g. `^1WORD rest` bolds only `WORD`). **Passage**
  scope is an explicit open/close pair that can span any number of words (e.g.
  `^7several bold words^'`); the terminator is placed unspaced immediately after the
  last word. These verified against the actual braille dot patterns (bold = dots-45,
  italic = dots-46, underline = dots-456; symbol = dots-23, word = dot-2, passage-begin
  = dots-2356, terminator = dot-3) — not liblouis's own back-translation, which doesn't
  interpret these as formatting on its own; `lex()` recognizes and strips them itself.

### `fromMarkdown(text, { table?, translateForward?, linesAreParagraphs? })`

The reverse direction: parses Markdown source into the same token tree shape `lex()`
builds from braille, forward-translating recognized prose/bold/italic/math into
braille-ASCII as it goes. Unrecognized Markdown constructs (headings, lists, tables,
etc.) are never dropped — their raw source is translated like ordinary prose and the
enclosing paragraph is flagged (see `DualDocument.errors` below). Used internally by
`DualDocument.fromMarkdown()`. With `linesAreParagraphs`, the derived braille paragraphs are
joined with a single newline (see `lex()`), and soft line wraps inside a Markdown paragraph
become spaces so they can't be mistaken for paragraph breaks.

### `wrapLatexDocument(body, { title?, author?, lang?, accessible? })`

Wraps converted LaTeX in a complete, compilable document — the one template shared by the
CLI's `--full-doc` and the web editor's LaTeX download. By default (`accessible: true`) it
requests a **tagged, PDF/UA-2 PDF**:

```latex
\DocumentMetadata{lang=en-US, pdfversion=2.0, pdfstandard=ua-2,
                  tagging=on, tagging-setup={math/setup=mathml-SE}}
\documentclass[fleqn]{article}   % + amsmath, amssymb, hyperref
\hypersetup{pdftitle={…}}
```

`tagging=on` builds the structure tree (screen readers need it, plus the document language and
title, with math exposed as MathML); `pdfstandard=ua-2` alone only *claims* conformance.
`title` defaults to "Untitled document" (PDF/UA requires one; no visible title page is added),
`lang` to `en-US`; both are escaped/validated before being written into the preamble.

- **Needs TeX Live / MiKTeX 2025 or later.** On older distributions `\DocumentMetadata`
  fails — pass `{ accessible: false }` (CLI: `--no-tagging`) for the legacy preamble.
- Checked on TeX Live 2026 with both `pdflatex` and `lualatex`, including Nemeth-derived math.
  Known limitation: under `lualatex` with tagging, a hand-written `\begin{equation}` combined
  with the `fleqn` option fails with a LuaTeX error; `pdflatex` is fine, and everything
  braille-bridge itself emits (`$…$`, `$$…$$`, `\textbf`, `\textit`) works on both.
- This produces the tags; it doesn't *validate* the PDF. Check the result with
  [veraPDF](https://verapdf.org/) or PAC before claiming conformance. The output is flat
  paragraphs and math — braille-bridge doesn't emit headings or lists.

### `ascii2Braille(str)` / `braille2Ascii(str)`

Convert between ASCII Braille notation and Unicode Braille characters.

### `nemeth_to_latex(str)`

Convert a line of Nemeth Braille (ASCII or Unicode) to a LaTeX math string.

### `latex_to_nemeth(str, options?)`

The reverse of `nemeth_to_latex()`: converts a LaTeX math expression (no surrounding
`$`/`$$` delimiters) to Nemeth Braille (ASCII). Unlike `nemeth_to_latex()`, this does
**not** tolerate incomplete/unbalanced LaTeX and does **not** fall back to passing
input through unchanged — it throws on invalid input, so callers can distinguish "no
translation available" from "here's a (possibly wrong) result." `options` is
forwarded to the underlying Abraham parser (e.g. `operatorNames`).

### `translateForward(text, table?)`

Forward-translates print text to Braille-ASCII using the liblouis WASM backend
configured via `configure()` — the mirror of back-translation. Requires `configure()`
to have been called first. If you need Unicode braille glyphs, pass the result through
`ascii2Braille()`.

### `convertText(text, from, to, extraOptions?)`

Converts text from one [Pandoc reader format](https://pandoc.org/MANUAL.html#general-options)
to another Pandoc writer format (e.g. `'latex'` → `'markdown'`, or `'markdown'` → `'rst'`).
Not for formats that need binary input/output (Word, ODT — see below). `extraOptions` is
merged verbatim into Pandoc's own options object — e.g. `{ standalone: true }` to wrap the
output as a complete document instead of a body fragment. Lazily loads `pandoc-wasm` on
first call (see the note in Install above).

### `convertToBinaryFormat(text, from, to, extraOptions?)`

Converts text to a binary-format document (Word `.docx`, ODT, …) via Pandoc, returning a
`Blob`. Any Pandoc writer name is accepted.

### `convertFromBinaryFormat(data, from, to, extraOptions?)`

Converts a binary-format document (`Blob`/`ArrayBuffer` — e.g. an uploaded `.docx` file) to
text via Pandoc. Any Pandoc reader name is accepted.

### `DualDocument`

A canonical braille⟷LaTeX/Markdown document model for building a side-by-side editor
where braille and one other format are directly editable and stay in sync at
paragraph/equation granularity (not full-document, not character-by-character). Wraps
the same `lex()`/`to_latex()`/`to_markdown()` tree.

```js
import { DualDocument } from '@brailletools/braille-bridge';

const doc = await DualDocument.fromBraille(brfText, { table: 'en-ueb-g2.ctb' });
doc.brailleText; // current braille source
doc.latexText;   // current generated LaTeX (kept eagerly in sync)
await doc.renderMarkdown(); // current generated Markdown (rendered on demand, not kept eagerly in sync)

// Apply an edit made in the braille pane (full new value + caret offset):
const { latexText, latexCursor } = await doc.applyBrailleEdit(newBrailleText, cursorOffset);

// Apply an edit made in the LaTeX pane:
const { brailleText, brailleCursor, nodeError } = await doc.applyLatexEdit(newLatexText, cursorOffset);

// Or, symmetrically, an edit made in the Markdown pane (call renderMarkdown() at
// least once first so its ranges are populated):
const { brailleText: b2, brailleCursor: c2 } = await doc.applyMarkdownEdit(newMarkdownText, cursorOffset);

// Nodes currently out of sync, or flagged at import time (e.g. an unrecognized
// Markdown construct — see fromMarkdown() above):
doc.errors; // [{ nodeId, pane, label, range, brailleRange, message }, ...]
```

`fromBraille()`/`fromMarkdown()` also take `{ linesAreParagraphs: true }` (see `lex()`); the
choice sticks to the document for every later edit, and is readable as `doc.linesAreParagraphs`.
To change it, build a new document from `doc.brailleText`.

`applyBrailleEdit`/`applyLatexEdit`/`applyMarkdownEdit` all only re-derive the top-level
node(s) (paragraph or equation) actually touched by the edit, splice the result into the
existing text, and return a best-effort proportional cursor position for the other pane
(`mapCursor()` is also exposed directly for mapping an arbitrary offset on demand). On a
translation failure (bad syntax, or an edit spanning more than one paragraph/equation —
there's no LaTeX/Markdown lexer to rediscover new boundaries), the braille pane is left
untouched and the affected node appears in `doc.errors` instead. `fromBraille()`/
`fromMarkdown()` accept the same `translate`/`translateForward` override hooks used
throughout this package, for testing without a live liblouis worker.

---

## Usage in SvelteKit / browser

liblouis's own npm packages (`liblouis`/`liblouis-build`) are unmaintained (years behind current liblouis) and no longer importable as a bundler dependency. Fetch a current browser build instead with
[`@brailletools/liblouis-env-web`](https://github.com/brailletools/liblouis-env/tree/main/js/packages/web),
which writes a `manifest.json` describing what it fetched (filenames and build variant vary by pinned upstream commit — read the manifest rather than hardcoding them), then load the vendored `easy-api.js` as a plain `<script>` so it's available as a global before `configure()` runs — braille-bridge itself has no dependency on `@brailletools/liblouis-env-web` or on any script-loading mechanism; where static assets live and how they're loaded is app-specific, so that step belongs here, in the consuming app:

```json
// package.json
"scripts": {
  "dev":   "liblouis-fetch-web static/liblouis && vite dev",
  "build": "liblouis-fetch-web static/liblouis && vite build"
}
```

```html
<!-- app.html -->
<script src="%sveltekit.assets%/liblouis/easy-api.js"></script>
```

```js
// +page.svelte
import { base } from '$app/paths';
import { configure, whenReady, DualDocument } from '@brailletools/braille-bridge';
import manifest from '../../static/liblouis/manifest.json';

const b = base === '/' ? '' : base;
configure({
  liblouisCapiUrl:    `.${b}/liblouis/${manifest.buildFile}`,
  liblouisEasyApiUrl: `.${b}/liblouis/${manifest.easyApiFile}`,
  // Only needed when manifest.variant === 'no-tables':
  liblouisTablesUrl:  `.${b}/liblouis/${manifest.tablesDir}/`,
});
await whenReady();

const doc = await DualDocument.fromBraille(brfFileContents);
const latex = doc.latexText;
```

## Command-line usage

```bash
braille-bridge <file.brf> [--table TABLE | --dictionary TABLE] [--format FORMAT] [--full-doc]
               [--title T] [--author A] [--lang L] [--no-tagging] [--line-paragraphs] [--braille-only] [-o FILE]
```

- `--table TABLE` / `--dictionary TABLE` — liblouis table to translate with (default: `en-ueb-g2.ctb`).
- `--format FORMAT` — output format (default: `latex`). `latex` and `markdown` are hand-rolled
  by this package directly (no Pandoc involved). Any other value is treated as a
  [Pandoc writer name](https://pandoc.org/MANUAL.html#general-options) (e.g. `docx`, `odt`,
  `rst`, `html`, `epub`) — the braille is rendered to Markdown first, then Pandoc converts
  Markdown → `FORMAT`. Binary writers (`docx`, `odt`, `pptx`, `epub`, `epub2`, `epub3`)
  require `-o`, since their output can't sensibly go to stdout.
- `--full-doc` — wrap the output in a complete document instead of just the translated body.
  For `latex` this is [`wrapLatexDocument()`](#wraplatexdocumentbody--title-author-lang-accessible-)'s
  tagged-PDF/UA-2 template (needs TeX Live 2025+ to compile); for `markdown` a YAML frontmatter
  block with `title` and `lang`; for any Pandoc-routed format it maps to Pandoc's own `standalone`
  option.
- `--title TEXT`, `--author TEXT`, `--lang TAG` — document metadata for `--full-doc` (title defaults
  to the input file's name, language to `en-US`).
- `--no-tagging` — with `--full-doc` LaTeX, use the legacy preamble instead of the tagged-PDF one
  (only needed for TeX distributions older than 2025).
- `--line-paragraphs` — treat every line of the BRF as its own paragraph, so no blank lines are
  needed between them (see [`lex()`](#lextext--linesareparagraphs-)). Off by default, since
  hard-wrapped BRFs use single newlines mid-paragraph.
- `--braille-only` — skip text back-translation entirely and always emit Unicode Braille for text sections
  (no external binary needed; Nemeth math is always converted regardless via the bundled Abraham parser).
- `-o, --output FILE` — write to `FILE` instead of stdout.

Nemeth math sections are fully converted via the bundled [Abraham](#credits) parser (pure JS, no
setup required). Text sections are back-translated by shelling out to a `lou_translate` binary,
resolved via [`@brailletools/liblouis-env`](https://github.com/brailletools/liblouis-env/tree/main/js/packages/node)
(checks the `LOU_TRANSLATE_PATH` environment variable, then `PATH`); if none is found, text falls back
to Unicode Braille and a note is printed to stderr. This command never installs anything itself — to
install `lou_translate` in one step, run:

```bash
npx liblouis-fetch
```

Examples:

```bash
braille-bridge "Sample Quiz.brf" --full-doc -o quiz.tex
braille-bridge "Sample Quiz.brf" --full-doc --title "Quiz 1" --lang en-US -o quiz.tex   # then: lualatex quiz.tex
braille-bridge answers.brf --line-paragraphs --format markdown
braille-bridge "Sample Quiz.brf" --dictionary en-ueb-g2.ctb
braille-bridge "Sample Quiz.brf" --format rst
braille-bridge "Sample Quiz.brf" --format docx -o quiz.docx
```

## Contributing and releases

Changes go through pull requests that must pass CI; releases are version tags on `main`. See
[RELEASING.md](RELEASING.md) for the steps.

## Credits

- [Abraham](https://www.desmos.com/api/v1.11/docs/abraham.html) (Desmos) — Nemeth to LaTeX
- [liblouis](https://github.com/liblouis/liblouis.js) — Braille back-translation (LGPL v2.1+)
