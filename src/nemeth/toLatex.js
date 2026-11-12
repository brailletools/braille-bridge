// Nemeth Braille Code (ASCII braille) -> LaTeX math, written from the BANA 2022
// Nemeth Code. See symbols.js for the tables and the notes on sources.
//
// Rules this parser implements deliberately (rule numbers are from the 2022 code):
//  - 3.x   numerals; numeric indicator `#` is skipped; digits directly after a letter
//          (no indicator) are a first-order numeric subscript (14.6).
//  - 5/6/7 capital (`,` `,,`), alphabet (`;` English, `.` Greek, `_` German) and
//          typeform indicators (`_` bold, `.` italic, `@` script, `,.` sans, `,_` barred).
//  - 13    simple / complex / hypercomplex fractions and the fractional part of a mixed number.
//  - 14    level indicators are ABSOLUTE paths from the baseline (`^`,`;`,`^^`,`;^`,`^;` ...);
//          a space, comma or punctuation indicator returns to the baseline (14.8).
//  - 15    modified expressions (`"expr<mod]`, and single-symbol `x<:]`).
//  - 16    radicals, index of radical and nested radicals.
//  - 18    function names.
//  - 19    grouping symbols.
//  - 21    comparison signs are only recognized when space-delimited; that is the only
//          thing distinguishing "=" (`.k`) from Greek kappa.
//
// NOT implemented yet (reported through `warnings`, never silently dropped): left
// superscripts/subscripts (14.5), spatial arrangements (Rule 25), matrices/arrays,
// chemistry/shape interiors (17.5+), Hebrew/Russian alphabets, transcriber's notes.

import {
	SYMBOLS as RAW_SYMBOLS,
	GROUPS as RAW_GROUPS,
	GREEK,
	GREEK_ALT,
	GREEK_CAPITAL,
	FUNCTIONS,
	OPERATORNAME_FUNCTIONS,
	MODIFIERS as RAW_MODIFIERS
} from './symbols.js';

const ALIASES = { '`': '@', '~': '^', '\x7f': '_', '{': '[', '|': '\\', '}': ']' };

/** Fold ASCII-braille aliases and case (a-z and A-Z are the same cells). */
export function normalize(text) {
	return text.replace(/[`~\x7f{|}]/g, (c) => ALIASES[c]).toLowerCase();
}

/**
 * Table keys are written in the spec's spelling, but input is alias-folded by normalize()
 * (`{ | }` -> `[ \\ ]`, backtick -> `@`, ...). Fold the keys the same way ONCE here so a
 * key can never silently fail to match because of how it was spelled.
 */
const foldKeys = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [normalize(k), v]));
const SYMBOLS = foldKeys(RAW_SYMBOLS);
const GROUPS = foldKeys(RAW_GROUPS);
const MODIFIERS = { over: foldKeys(RAW_MODIFIERS.over), under: foldKeys(RAW_MODIFIERS.under) };

const SYMBOL_KEYS = Object.keys(SYMBOLS).sort((a, b) => b.length - a.length);
const GROUP_KEYS = Object.keys(GROUPS).sort((a, b) => b.length - a.length);
const OVER_KEYS = Object.keys(MODIFIERS.over).sort((a, b) => b.length - a.length);
const UNDER_KEYS = Object.keys(MODIFIERS.under).sort((a, b) => b.length - a.length);
const FUNCTION_NAMES = new Set([...FUNCTIONS, ...OPERATORNAME_FUNCTIONS]);

const TYPEFORMS = [
	[',.', (x) => `\\mathsf{${x}}`],
	[',_', (x) => `\\mathbb{${x}}`],
	['_', (x) => `\\mathbf{${x}}`],
	['.', (x) => `\\mathit{${x}}`],
	['@', (x) => `\\mathcal{${x}}`]
];
const NEGATED = {
	'=': '\\neq',
	'<': '\\nless',
	'>': '\\ngtr',
	'\\leq': '\\nleq',
	'\\geq': '\\ngeq',
	'\\in': '\\notin',
	'\\parallel': '\\nparallel',
	'\\sim': '\\nsim',
	'\\subseteq': '\\nsubseteq',
	'\\supseteq': '\\nsupseteq'
};
const PUNCTUATION = { 1: ',', 2: ';', 3: ':', 4: '.', 6: '!', 8: '?' };

const isDigit = (c) => c >= '0' && c <= '9';
const isLetter = (c) => c >= 'a' && c <= 'z';
const isSpace = (c) => c === ' ' || c === '\t';

/** Collects LaTeX, tracking open script levels relative to a base. */
class Out {
	constructor() {
		this.parts = [];
		this.stack = ''; // relative level path: 'u' / 'd' chars
		this.hasBase = false; // is there an operand a script could attach to?
		this.closedKind = ''; // kind of the script brace just closed, if it is the last part
		this.unitIdx = -1; // index in parts of the last operand, for single-symbol modifiers
	}
	atBase() {
		return this.stack === '';
	}
	/** Append, inserting a space where a trailing \\command would swallow a following letter. */
	push(t) {
		const prev = this.parts[this.parts.length - 1];
		if (prev !== undefined && /\\[a-zA-Z]+$/.test(prev) && /^[a-zA-Z]/.test(t)) this.parts.push(' ');
		this.parts.push(t);
	}
	setRel(rel) {
		let k = 0;
		while (k < this.stack.length && k < rel.length && this.stack[k] === rel[k]) k++;
		while (this.stack.length > k) {
			this.parts.push('}');
			this.closedKind = this.stack[this.stack.length - 1];
			this.stack = this.stack.slice(0, -1);
		}
		for (const ch of rel.slice(k)) {
			// `x^{a}^{b}` is a LaTeX error, and a script with no operand needs an empty one.
			if (!this.hasBase || this.closedKind === ch) this.parts.push('{}');
			this.parts.push(ch === 'u' ? '^{' : '_{');
			this.closedKind = '';
			this.hasBase = false;
			this.stack += ch;
		}
	}
	unit(t) {
		this.push(t);
		this.unitIdx = this.parts.length - 1;
		this.hasBase = true;
		this.closedKind = '';
	}
	raw(t) {
		this.push(t);
		this.hasBase = false;
		this.closedKind = '';
	}
	finish() {
		this.setRel('');
		return this.parts.join('');
	}
}

const LIMIT_NAMES = new Set(['lim', 'liminf', 'limsup', 'max', 'min', 'sup', 'inf']);

// Big operators that take stacked limits, longest key first.
const BIG_SIGNS = [
	['!@$c]', '\\oint'],
	['!!!', '\\iiint'],
	['!!', '\\iint'],
	['!', '\\int'],
	['.,s', '\\sum'],
	['.,p', '\\prod']
];

class Parser {
	constructor(src) {
		this.s = normalize(src);
		this.i = 0;
		this.warnings = [];
		this.last = 'none'; // kind of last atom: letter|number|func|close|op|space|none ...
	}

	warn(msg) {
		this.warnings.push(`${msg} (at ${this.i}: ${JSON.stringify(this.s.slice(this.i, this.i + 8))})`);
	}
	at(str, k = this.i) {
		return this.s.startsWith(str, k);
	}
	get canScript() {
		return ['letter', 'number', 'func', 'close', 'unit', 'sub'].includes(this.last);
	}

	/**
	 * Parse items until a stop string is seen at the base level (not consumed) or input ends.
	 * `base` is the absolute level path of the construct being parsed (e.g. a radical that
	 * itself sits at a superscript level): level indicators inside are absolute paths, and
	 * the portion shared with `base` is stripped.
	 */
	seq(stops = [], base = '') {
		const out = new Out();
		const prevLast = this.last;
		this.last = 'none';
		const s = this.s;
		const rel = (path) => (path.startsWith(base) ? path.slice(base.length) : path);

		while (this.i < s.length) {
			if (out.atBase()) {
				if (stops.some((st) => this.at(st))) break;
			}
			const c = s[this.i];

			if (isSpace(c)) {
				out.setRel('');
				out.raw(' ');
				this.i++;
				this.last = 'space';
				continue;
			}

			// ---- level indicators (14.3) ----
			if (c === '^' || (c === ';' && (this.canScript || /^;[^ ";^]{1,6}"[^ ]/.test(s.slice(this.i))))) {
				let j = this.i;
				let path = '';
				while (j < s.length && path.length < 3 && (s[j] === '^' || s[j] === ';')) {
					path += s[j] === '^' ? 'u' : 'd';
					j++;
				}
				this.i = j;
				out.setRel(rel(path));
				this.last = 'level';
				continue;
			}
			if (c === '"') {
				if (!out.atBase()) {
					out.setRel('');
					this.i++;
					this.last = 'level';
					// 14.5.2: a baseline/multipurpose indicator directly followed by a level
					// indicator separates a right script from a LEFT script of the next symbol.
					if (s[this.i] === '^' || s[this.i] === ';') out.hasBase = false;
					continue;
				}
				if (this.tryBigLimits(out, base)) continue;
				if (this.tryCompoundRel(out) || this.trySymbol(out)) continue; // `"k` (<), `"1` (ratio) ...
				if (s[this.i + 1] === '<' || s[this.i + 1] === '%') {
					this.i++; // `"` restating baseline before a modifier indicator: no-op
					continue;
				}
				if (this.tryModified(out, base)) continue;
				this.i++; // lone baseline indicator at baseline: no-op
				continue;
			}

			// ---- numeric indicator ----
			if (c === '#') {
				this.i++;
				this.last = this.last === 'letter' ? 'none' : this.last;
				continue;
			}

			// ---- numerals (3.1, 3.2) and numeric subscripts (14.6) ----
			if (isDigit(c) || (c === '.' && isDigit(s[this.i + 1] || '') && !this.canScript && !this.spacedRelAt(this.i))) {
				const num = this.number();
				const numericSub = this.last === 'letter' || this.last === 'func' || this.last === 'prime';
				if (!(this.last === 'letter' || this.last === 'func' || this.last === 'prime') && this.contractedBarAfterNumber(out, num)) {
					continue;
				}
				if (numericSub && out.atBase() && !this.sawSpaceBefore(out)) {
					out.raw(`_{${num}}`);
					out.hasBase = true;
					this.last = 'sub';
				} else {
					out.unit(num);
					this.last = 'number';
				}
				continue;
			}

			// ---- fractions (13) ----
			const frac = this.tryFraction(out, base + out.stack);
			if (frac) continue;

			// ---- radicals (16) ----
			if (this.tryRadical(out, base + out.stack)) continue;

			// ---- grouping (19) ----
			let matched = false;
			if (c === '(' && this.tryBinomial(out, base + out.stack)) continue;
			for (const k of GROUP_KEYS) {
				if (this.at(k)) {
					const isOpen = k.endsWith('(');
					out.unit(GROUPS[k]);
					this.i += k.length;
					this.last = isOpen ? 'open' : 'close';
					if (isOpen) out.hasBase = false; // a script right after an opener is a LEFT script
					matched = true;
					break;
				}
			}
			if (matched) continue;

			// ---- directly-over / under modifier following one symbol (15.2) ----
			if ((c === '<' || c === '%') && this.canScript && this.tryPostModifier(out)) continue;

			// ---- comparison and other symbols (Rules 20-23) ----
			if (this.tryNegation(out) || this.tryCompoundRel(out) || this.trySymbol(out)) continue;

			// ---- letters, alphabets, typeforms, functions (5-7, 18) ----
			if (this.tryLetter(out)) {
				this.contractedBar(out);
				continue;
			}

			// ---- primes / ellipsis ----
			if (c === "'") {
				out.unit("'");
				this.i++;
				this.last = 'prime';
				continue;
			}

			// ---- comma, punctuation indicator (14.8.2) ----
			if (c === ',') {
				out.setRel('');
				out.raw(',');
				this.i++;
				this.last = 'op';
				continue;
			}
			if (c === '_' && PUNCTUATION[s[this.i + 1]]) {
				out.setRel('');
				out.raw(PUNCTUATION[s[this.i + 1]]);
				this.i += 2;
				this.last = 'op';
				continue;
			}
			if (c === '&') {
				out.unit('!'); // factorial (Greek chi needs the Greek indicator)
				this.i++;
				this.last = 'unit';
				continue;
			}
			if (c === '[') {
				if (!out.atBase()) {
					out.raw(','); // contracted comma (+ space) at script level (14.8)
				} else {
					this.warn('cancellation indicator not supported');
				}
				this.i++;
				continue;
			}
			if (c === ']') {
				// stray termination indicator; consumed by the construct that opened it, so
				// reaching here means there was none.
				this.i++;
				continue;
			}

			// ---- unknown ----
			this.warn(`unrecognized Nemeth cell ${JSON.stringify(c)}`);
			// Placeholder for the raw cell: it may be a control or TeX-special character.
			out.unit(`\\text{[U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}]}`);
			this.i++;
			this.last = 'unit';
		}

		const result = out.finish();
		this.last = this.last === 'none' ? prevLast : this.last;
		return result;
	}

	/** 15.2.2-15.2.3: a letter followed directly by `:` is barred; `%:` is barred below. */
	contractedBar(out) {
		const s = this.s;
		if (this.last !== 'letter' || out.unitIdx < 0) return;
		if (s[this.i] === ':') {
			out.parts[out.unitIdx] = `\\overline{${out.parts[out.unitIdx]}}`;
			this.i++;
		} else if (s[this.i] === '%' && s[this.i + 1] === ':') {
			out.parts[out.unitIdx] = `\\underline{${out.parts[out.unitIdx]}}`;
			this.i += 2;
		}
	}
	/** A numeral followed directly by `:` carries a bar over the whole numeral (ex 15-18). */
	contractedBarAfterNumber(out, num) {
		if (this.s[this.i] !== ':') return false;
		this.i++;
		out.unit(`\\overline{${num}}`);
		this.last = 'number';
		return true;
	}

	sawSpaceBefore() {
		return this.i === 0 ? true : isSpace(this.s[this.i - 1] || ' ');
	}

	number() {
		const s = this.s;
		let t = '';
		while (this.i < s.length) {
			const c = s[this.i];
			if (isDigit(c)) {
				t += c;
				this.i++;
			} else if (c === '.' && isDigit(s[this.i + 1] || '')) {
				t += '.';
				this.i++;
			} else if (c === ',' && isDigit(s[this.i + 1] || '') && t && /\d$/.test(t) && this.isThousands()) {
				t += '{,}';
				this.i++;
			} else break;
		}
		return t;
	}
	/** A numeric comma is followed by exactly three digits then a non-digit. */
	isThousands() {
		return /^,\d{3}(?!\d)/.test(this.s.slice(this.i));
	}

	// ---------------- fractions ----------------
	tryFraction(out, base) {
		const opens = [
			[',,?', ',,/', ',,#'],
			[',?', ',/', ',#'],
			['_?', '/', '_#'],
			['?', '/', '#']
		];
		for (const [open, line, close] of opens) {
			if (!this.at(open)) continue;
			this.i += open.length;
			const num = this.seq([line], base);
			if (!this.at(line)) {
				this.warn('fraction without fraction line');
				out.unit(`\\frac{${num}}{}`);
				this.last = 'unit';
				return true;
			}
			this.i += line.length;
			const den = this.seq([close], base);
			if (this.at(close)) this.i += close.length;
			else this.warn('unterminated fraction');
			out.unit(`\\frac{${num}}{${den}}`);
			this.last = 'close';
			return true;
		}
		return false;
	}

	// ---------------- radicals ----------------
	tryRadical(out, base) {
		const s = this.s;
		// order-of-radical dots, then `>`
		let j = this.i;
		let dots = 0;
		while (s[j] === '.') {
			dots++;
			j++;
		}
		let index = null;
		if (s[j] === '<') {
			// index of radical: < index >
			const saveI = this.i;
			const warnLen = this.warnings.length;
			const lastSave = this.last;
			this.i = j + 1;
			const idx = this.seq(['>'], base);
			if (this.at('>')) {
				index = idx;
				j = this.i;
			} else {
				this.i = saveI;
				this.warnings.length = warnLen;
				this.last = lastSave;
				return false;
			}
		}
		if (s[j] !== '>') return false;
		this.i = j + 1;
		const close = '.'.repeat(dots) + ']';
		const body = this.seq([close], base);
		if (this.at(close)) this.i += close.length;
		else this.warn('unterminated radical');
		out.unit(index !== null ? `\\sqrt[${index}]{${body}}` : `\\sqrt{${body}}`);
		this.last = 'close';
		return true;
	}

	// ---------------- modifiers ----------------
	/**
	 * Big operator with its limits directly under and over it (15, ex 21-27; 11.9, ex 5-6):
	 * [`"`] sign `%` lower [`<` upper] `]`. Material before the sign is not part of it.
	 */
	tryBigLimits(out, base) {
		const s = this.s;
		let j = this.i;
		if (s[j] === '"') j++;
		let sign = BIG_SIGNS.find(([k]) => s.startsWith(k, j));
		if (!sign) {
			// limit functions: `"lim%x $o #0]` (15, ex 21; 11.8)
			const m = /^[a-z]+/.exec(s.slice(j));
			const name = m && LIMIT_NAMES.has(m[0]) ? m[0] : null;
			if (name) sign = [name, `\\${name}`];
		}
		if (!sign || s[j + sign[0].length] !== '%') return false;
		const isFn = /^[a-z]/.test(sign[0]);
		const save = this.i;
		const warnLen = this.warnings.length;
		const lastSave = this.last;
		this.i = j + sign[0].length + 1;
		const lower = this.seq(['<', ']'], base);
		let upper = null;
		if (this.at('<')) {
			this.i++;
			upper = this.seq([']'], base);
		}
		if (this.at(']') || this.i >= s.length) {
			// (a terminator missing at the very end of the line is tolerated)
			if (this.at(']')) this.i++;
			if (isFn) {
				out.unit(`${sign[1]}_{${lower}}`);
				this.last = 'func';
				return true;
			}
			const limits = sign[1] === '\\sum' || sign[1] === '\\prod' ? '' : '\\limits'; // sum/prod stack by default
			out.unit(`${sign[1]}${limits}_{${lower}}${upper !== null ? `^{${upper}}` : ''}`);
			this.last = 'unit';
			return true;
		}
		this.i = save;
		this.warnings.length = warnLen;
		this.last = lastSave;
		return false;
	}

	/** `"` expression `<` modifier `]`  /  `%` modifier `]` */
	tryModified(out, base) {
		const save = this.i;
		const warnLen = this.warnings.length;
		this.i++; // consume multipurpose indicator
		const inner = this.seq(['<', '%'], base);
		const mod = this.readModifier();
		if (mod) {
			out.unit(mod(inner));
			this.last = 'close';
			return true;
		}
		this.i = save;
		this.warnings.length = warnLen;
		return false;
	}
	/** After one symbol: `x<:]` (bar over x). */
	tryPostModifier(out) {
		const save = this.i;
		const mod = this.readModifier();
		if (!mod) {
			this.i = save;
			return false;
		}
		const idx = out.unitIdx;
		if (idx < 0) return false;
		out.parts[idx] = mod(out.parts[idx]);
		this.last = 'close';
		return true;
	}
	/** Reads `<`/`%` (optionally doubled), a modifier symbol and `]`; returns a wrapper or null. */
	readModifier() {
		const s = this.s;
		const dir = s[this.i];
		if (dir !== '<' && dir !== '%') return null;
		let j = this.i + 1;
		if (s[j] === dir) j++; // second-order modifier
		const table = dir === '<' ? MODIFIERS.over : MODIFIERS.under;
		const keys = dir === '<' ? OVER_KEYS : UNDER_KEYS;
		for (const k of keys) {
			if (s.startsWith(k, j) && s[j + k.length] === ']') {
				this.i = j + k.length + 1;
				return table[k];
			}
		}
		return null;
	}

	// ---------------- binomial coefficient (15.6) ----------------
	/** `(` upper `%` lower `)` -- directly-under indicator with no modifier symbol. */
	tryBinomial(out, base) {
		const save = this.i;
		const warnLen = this.warnings.length;
		const lastSave = this.last;
		this.i++;
		const upper = this.seq(['%', ')'], base);
		if (this.at('%') && !this.readModifierPeek()) {
			this.i++;
			const lower = this.seq([')'], base);
			if (this.at(')')) {
				this.i++;
				out.unit(`\\binom{${upper}}{${lower}}`);
				this.last = 'close';
				return true;
			}
		}
		this.i = save;
		this.warnings.length = warnLen;
		this.last = lastSave;
		return false;
	}
	readModifierPeek() {
		const save = this.i;
		const m = this.readModifier();
		this.i = save;
		return m;
	}

	// ---------------- compound comparison signs (21.8-21.12) ----------------
	/** A comparison sign (e.g. `.1` for >) standing alone between spaces at `j`. */
	spacedRelAt(j) {
		const s = this.s;
		if (!(j === 0 || isSpace(s[j - 1]))) return false;
		const k = this.relKeyAt(j);
		return k !== null && (j + k.length >= s.length || isSpace(s[j + k.length]) || s[j + k.length] === ':');
	}
	/** Longest comparison sign starting at `j`, or null. */
	relKeyAt(j) {
		for (const k of SYMBOL_KEYS) if (SYMBOLS[k].rel && this.s.startsWith(k, j)) return k;
		return null;
	}
	/**
	 * Comparison signs built from other comparison signs:
	 *   - vertical stack (21.9): the signs unspaced, top to bottom  -> \overset{top}{bottom}
	 *   - horizontal run (21.11): signs joined by the multipurpose indicator `"`
	 *   - bar / equals sign underneath (21.5-21.7): a `:` or `.k` suffix on any sign
	 * Known single symbols (`"k:` is <=) are table entries and match as one; this handles
	 * every combination the table does not list. Like any comparison sign the whole
	 * thing must be space-delimited. Superposition (`a@b]`) is not supported.
	 */
	tryCompoundRel(out) {
		const s = this.s;
		if (!(this.i === 0 || isSpace(s[this.i - 1]))) return false;
		const parts = []; // [latex, joinedBy]
		let j = this.i;
		let join = null;
		let suffixed = false;
		for (;;) {
			const k = this.relKeyAt(j);
			if (!k) return false;
			let latex = SYMBOLS[k].latex;
			j += k.length;
			if (s[j] === ':' ) {
				latex = `\\underline{${latex}}`;
				j++;
				suffixed = true;
			} else if (s.startsWith('.k', j) && !(j + 2 < s.length && !isSpace(s[j + 2]) && s[j + 2] !== '"' && !this.relKeyAt(j + 2))) {
				// `.k` directly after a sign is "equals underneath" -- but only if it ends the sign
				latex = `\\underset{=}{${latex}}`;
				j += 2;
				suffixed = true;
			}
			parts.push([latex, join]);
			if (s[j] === '"' && this.relKeyAt(j + 1)) {
				join = 'h';
				j++;
			} else if (this.relKeyAt(j)) {
				join = 'v';
			} else break;
		}
		if (!(j >= s.length || isSpace(s[j]))) return false;
		if (parts.length === 1 && !suffixed) return false; // plain sign: normal path
		// fold left to right: horizontal runs concatenate, vertical stacks overset
		let latex = parts[0][0];
		for (const [l, how] of parts.slice(1)) latex = how === 'h' ? `${latex}\\;${l}` : `\\overset{${latex}}{${l}}`;
		out.unit(latex);
		out.hasBase = false;
		this.i = j;
		this.last = 'op';
		return true;
	}

	// ---------------- negation (21.1) ----------------
	/** `/` unspaced before a comparison sign negates it. */
	tryNegation(out) {
		const s = this.s;
		if (s[this.i] !== '/') return false;
		const before = this.i === 0 || isSpace(s[this.i - 1]);
		if (!before) return false;
		for (const k of SYMBOL_KEYS) {
			const sym = SYMBOLS[k];
			if (!sym.rel || !s.startsWith(k, this.i + 1)) continue;
			const end = this.i + 1 + k.length;
			if (!(end >= s.length || isSpace(s[end]))) continue;
			this.i = end;
			out.unit(NEGATED[sym.latex] ?? `\\not${sym.latex}`);
			this.last = 'op';
			out.hasBase = false;
			return true;
		}
		return false;
	}

	// ---------------- symbols ----------------
	trySymbol(out) {
		const s = this.s;
		for (const k of SYMBOL_KEYS) {
			if (!this.at(k)) continue;
			const sym = SYMBOLS[k];
			if (sym.rel) {
				// comparison signs must be space-delimited (or at the line boundary)
				const before = this.i === 0 || isSpace(s[this.i - 1]);
				const after = this.i + k.length >= s.length || isSpace(s[this.i + k.length]);
				if (!(before && after)) {
					// the tilde of logic (negation) is not space-delimited: `@:p@%@:q` (10.2)
					if (k === '@:' && !(this.i + 2 >= s.length || isSpace(s[this.i + 2]))) {
						this.i += 2;
						out.unit('\\neg ');
						this.last = 'op';
						out.hasBase = false;
						return true;
					}
					continue;
				}
			}
			if (k === "'''" && this.canScript && !sym.rel) {
				// three primes after an operand, not an ellipsis
				const before = this.i === 0 || isSpace(s[this.i - 1]);
				if (!before) continue;
			}
			// an arrow/shape or `$`-sequence only counts if what follows is not a longer shape
			let latex = sym.latex;
			this.i += k.length;
			// big operators take limits via level indicators; Sigma/Pi handled in letters.
			out.unit(latex);
			this.last = sym.rel ? 'op' : ['!', '!!', '!!!'].includes(k) ? 'unit' : 'op';
			if (['!', '!!', '!!!'].includes(k)) this.last = 'unit';
			if (this.last === 'op') out.hasBase = false;
			return true;
		}
		return false;
	}

	// ---------------- letters ----------------
	/** Reads an alphabet indicator at position p: {alpha, len} or null. */
	alphabetAt(p) {
		const s = this.s;
		if (s.startsWith('.@', p)) return { alpha: 'gralt', len: 2 };
		if (s[p] === ';') return { alpha: 'en', len: 1 };
		if (s[p] === '.') return { alpha: 'gr', len: 1 };
		if (s[p] === '_') return { alpha: 'de', len: 1 };
		return null;
	}

	tryLetter(out) {
		const s = this.s;
		let k = this.i;
		let wrap = null;

		// typeform indicator: must be followed by an alphabet indicator (7.2.1) or `#` (7.2.2)
		for (const [tf, fn] of TYPEFORMS) {
			if (!s.startsWith(tf, k)) continue;
			const after = k + tf.length;
			if (s[after] === '#') {
				// typeform numeral
				this.i = after + 1;
				const num = this.number();
				out.unit(fn(num));
				this.last = 'number';
				return true;
			}
			if (this.alphabetAt(after)) {
				wrap = fn;
				k = after;
				break;
			}
		}

		let alpha = null;
		const ab = this.alphabetAt(k);
		if (ab) {
			// `.`/`_`/`;` + (optional capital) + a letter cell
			let p = k + ab.len;
			let cap = false;
			if (s[p] === ',') {
				cap = true;
				p++;
			}
			const ch = s[p];
			const valid =
				ab.alpha === 'en' || ab.alpha === 'de'
					? isLetter(ch)
					: ch !== undefined && Object.prototype.hasOwnProperty.call(GREEK, ch);
			if (valid && (wrap || ab.alpha !== 'en' || !this.canScript)) {
				alpha = { ...ab, cap, ch, end: p + 1 };
			}
		}
		if (alpha) {
			this.i = alpha.end;
			let t;
			if (alpha.alpha === 'en') {
				t = alpha.cap ? alpha.ch.toUpperCase() : alpha.ch;
			} else if (alpha.alpha === 'de') {
				t = `\\mathfrak{${alpha.cap ? alpha.ch.toUpperCase() : alpha.ch}}`;
			} else {
				t = this.greek(alpha.ch, alpha.cap, alpha.alpha === 'gralt');
			}
			if (wrap) t = wrap(t);
			out.unit(t);
			this.last = 'letter';
			return true;
		}
		if (wrap) return false;

		// capital letter(s) with no alphabet indicator: `,x` or `,,word`
		if (s.startsWith(',,', k) && isLetter(s[k + 2] || '')) {
			let j = k + 2;
			let word = '';
			while (isLetter(s[j] || '')) word += s[j++];
			this.i = j;
			for (const c of word.toUpperCase()) out.unit(c);
			this.last = 'letter';
			return true;
		}
		if (s[k] === ',' && isLetter(s[k + 1] || '')) {
			this.i = k + 2;
			out.unit(s[k + 1].toUpperCase());
			this.last = 'letter';
			return true;
		}

		// function names / plain letters
		if (isLetter(s[k])) {
			let j = k;
			while (isLetter(s[j] || '')) j++;
			const run = s.slice(k, j);
			if (FUNCTION_NAMES.has(run)) {
				this.i = j;
				out.unit(FUNCTIONS.has(run) ? `\\${run}` : `\\operatorname{${run}}`);
				this.last = 'func';
				return true;
			}
			this.i = k + 1;
			out.unit(s[k]);
			this.last = 'letter';
			return true;
		}
		return false;
	}

	greek(ch, cap, alt) {
		const name = GREEK[ch];
		if (alt && GREEK_ALT[ch]) return GREEK_ALT[ch];
		if (cap) {
			if (GREEK_CAPITAL.has(name)) {
				// Sigma / Pi followed by a limit indicator are the big operators
				const next = this.s[this.i];
				if ((name === 'sigma' || name === 'pi') && (next === ';' || next === '<' || next === '%')) {
					return name === 'sigma' ? '\\sum' : '\\prod';
				}
				return `\\${name[0].toUpperCase()}${name.slice(1)}`;
			}
			return latinCapital(name);
		}
		return name === 'o' ? 'o' : `\\${name}`;
	}
}

/** Greek capitals with no LaTeX command are the Latin capital letter. */
function latinCapital(name) {
	const map = {
		alpha: 'A',
		beta: 'B',
		epsilon: 'E',
		zeta: 'Z',
		eta: 'H',
		iota: 'I',
		kappa: 'K',
		mu: 'M',
		nu: 'N',
		omicron: 'O',
		rho: 'P',
		tau: 'T',
		chi: 'X'
	};
	return map[name] ?? name;
}

/**
 * Translate ONE line of Nemeth (ASCII braille, no `_%`/`_:` switch indicators).
 * @param {string} text
 * @returns {{ latex: string, warnings: string[] }}
 */
export function nemethToLatexDetailed(text) {
	const p = new Parser(text);
	const latex = p.seq();
	return { latex, warnings: p.warnings };
}

/** Multi-line convenience: translates each line, preserving blank lines. */
export function nemethToLatex(text) {
	const warnings = [];
	const latex = text
		.split('\n')
		.map((line) => {
			if (line.trim() === '') return '';
			const r = nemethToLatexDetailed(line);
			warnings.push(...r.warnings);
			return r.latex;
		})
		.join('\n');
	return { latex, warnings };
}
