// LaTeX math -> Nemeth Braille Code (ASCII braille), written from the BANA 2022
// Nemeth Code. The tables are the inverse of the ones used for Nemeth -> LaTeX
// (symbols.js), so the two directions cannot drift apart.
//
// Rules implemented (2022 code):
//  3.3/3.4  numeric indicator `#` only at the start of a line or after a space (or after
//           a leading minus); never after an unspaced symbol, letter or indicator.
//  5, 6.3   capital indicator `,`; English-letter indicator `;` on a SINGLE regular
//           letter (isolated, unmodified) with the exemptions of 6.4 (next to a
//           comparison sign, inside grouping/enclosed lists, after a function name,
//           in arrays, ...).
//  7        typeform indicators, always followed by an alphabetic indicator.
//  13       fractions: simple `?..#`, complex `,?..,#`, hypercomplex `,,?..,,#`, mixed
//           numbers `_?..._#`; a slash inside running text is `_/`.
//  14       level indicators are absolute paths; the return to the baseline is emitted
//           lazily -- before the next symbol or any closing indicator -- and dropped
//           before a space or the end. First-order numeric subscripts need no `;`
//           and no return (14.6, 14.10.1). Simultaneous scripts put the subscript
//           first (14.11). A left script is written with no base.
//  15       modified expressions `"expr<mod]`, contracted `x:` for a barred letter or digit,
//           limits `"lim%x $o #0]`, big operators `".,s%i .k #1<,=]`.
//  16       radicals `>..]`, index `<n>`, nested radicals with order dots.
//  18, 20, 21  one space after a function name; no space around operations;
//           a space on both sides of a comparison sign.
//  19       grouping symbols; `\left..\right` use the enlarged forms.
//  25.8     matrices and determinants as aligned rows in enlarged brackets.
//
// Anything not covered throws UnsupportedLatexError (see latexParse.js).

import { parseLatex, UnsupportedLatexError } from './latexParse.js';
import { SYMBOLS, GREEK, GREEK_ALT } from './symbols.js';
import { normalize } from './toLatex.js';

// ---------- tables (inverted from symbols.js) ----------
const INVERSE = {};
for (const [key, sym] of Object.entries(SYMBOLS)) {
	const braille = normalize(key);
	const cur = INVERSE[sym.latex];
	const better =
		!cur ||
		(cur.braille.includes(']') && !braille.includes(']')) ||
		(braille.length < cur.braille.length && !braille.includes(']'));
	if (better) INVERSE[sym.latex] = { braille, rel: !!sym.rel };
}
// Spellings LaTeX has that the Nemeth->LaTeX table does not carry.
const EXTRA = {
	'=': { braille: '.k', rel: true },
	'<': { braille: '"k', rel: true },
	'>': { braille: '.1', rel: true },
	':': { braille: '"1', rel: true },
	'/': { braille: '_/' },
	'*': { braille: '@#' },
	'.': { braille: '_4' },
	'|': { braille: '\\' },
	'\\|': { braille: '\\\\' },
	'\\%': { braille: '@0' },
	'\\$': { braille: '@s' },
	'\\#': { braille: '.#' },
	'\\&': { braille: '_&' },
	'\\le': { braille: '"k:', rel: true },
	'\\ge': { braille: '.1:', rel: true },
	'\\ne': { braille: '/.k', rel: true },
	'\\rightarrow': { braille: '$33o', rel: true },
	'\\neg': { braille: '@:' },
	'\\lnot': { braille: '@:' },
	'\\square': { braille: '$4' },
	'\\gets': { braille: '$[33', rel: true },
	'\\iff': { braille: '$[77o', rel: true },
	'\\implies': { braille: '$777o', rel: true },
	'\\Longleftrightarrow': { braille: '$[777o', rel: true },
	'\\infty': { braille: ',=' },
	'\\cdots': { braille: "'''", ellipsis: true },
	'\\dots': { braille: "'''", ellipsis: true },
	'\\ldots': { braille: "'''", ellipsis: true },
	'\\vdots': { braille: "%''" },
	'\\prime': { braille: "'" },
	'\\circ': { braille: '.*' },
	'\\wedge': { braille: '@%' },
	'\\land': { braille: '@%' },
	'\\vee': { braille: '@+' },
	'\\lor': { braille: '@+' },
	'\\varnothing': { braille: '_0' },
	'\\emptyset': { braille: '_0' },
	'\\dagger': { braille: '_]' },
	'\\ddagger': { braille: '__]' },
	'\\notin': { braille: '/@e', rel: true },
	'\\nless': { braille: '/"k', rel: true },
	'\\ngtr': { braille: '/.1', rel: true },
	'\\nleq': { braille: '/"k:', rel: true },
	'\\ngeq': { braille: '/.1:', rel: true },
	'\\nparallel': { braille: '/$l', rel: true },
	'\\nsim': { braille: '/@:', rel: true },
	'\\nsubseteq': { braille: '/_"k:', rel: true },
	'\\nsupseteq': { braille: '/_.1:', rel: true }
};
for (const [k, v] of Object.entries(EXTRA)) INVERSE[k] = v;
for (const k of ['+', '-']) INVERSE[k] = { braille: k };
delete INVERSE[','];

const OPEN = { '(': '(', '[': '@(', '\\{': '.(', '\\langle': '..(', '\\lfloor': '@;(', '\\lceil': '@^(', '\\lbrack': '@(' };
const CLOSE = { ')': ')', ']': '@)', '\\}': '.)', '\\rangle': '..)', '\\rfloor': '@;)', '\\rceil': '@^)', '\\rbrack': '@)' };
const ENLARGED_OPEN = { '(': ',(', '[': '@,(', '\\{': '.,(' };
const ENLARGED_CLOSE = { ')': ',)', ']': '@,)', '\\}': '.,)' };

const GREEK_CELL = Object.fromEntries(Object.entries(GREEK).map(([cell, name]) => [name, cell]));
// \varepsilon -> 'epsilon' (the parser strips the `var` prefix), mapped to its cell.
const GREEK_ALT_CELL = Object.fromEntries(Object.entries(GREEK_ALT).map(([cell, cmd]) => [cmd.slice(4), cell]));

const TYPEFORM = { bold: '_', italic: '.', script: '@', sans: ',.', barred: ',_' };
const ACCENT = { bar: ':', hat: '_<', tilde: '@:', vec: '33@o', ray: '$o', line: '$[33o', arc: '$a', dot: '*', ddot: '**', ring: '.*' };
const NUMERIC_BASE_OK = new Set(['id', 'greek', 'fn']);
const LIMIT_FUNCTIONS = new Set(['lim', 'liminf', 'limsup']);

const levelStr = (path) => (path === '' ? '"' : path);

// ---------- helpers over the AST ----------
function flatten(nodes) {
	const out = [];
	for (const n of nodes) {
		if (n.t === 'seqnode') out.push(...flatten(n.nodes));
		else out.push(n);
	}
	return out;
}
/** Deepest chain of baseline-level fractions inside `nodes` (script levels excluded). */
function fracDepthIn(nodes) {
	let d = 0;
	for (const n of flatten(nodes)) {
		if (n.t === 'frac') d = Math.max(d, fracDepth(n));
		else if (n.t === 'sqrt') d = Math.max(d, fracDepthIn(n.body));
		else if (n.t === 'group') d = Math.max(d, fracDepthIn(n.body));
		else if (n.t === 'acc') d = Math.max(d, fracDepthIn(n.body));
		else if (n.t === 'script' && n.base) d = Math.max(d, fracDepthIn([n.base]));
	}
	return d;
}
const fracDepth = (n) => 1 + Math.max(fracDepthIn(n.n), fracDepthIn(n.d));
const isIntegerNum = (n) => n && n.t === 'num' && /^\d+$/.test(n.v) && !n.style;

class Gen {
	constructor({ inArray = false } = {}) {
		this.out = '';
		this.level = ''; // absolute path of the level currently being written
		this.pending = null; // level to return to before the next symbol, or null
		this.needSpace = false;
		this.radDepth = 0;
		this.depth = 0; // nesting of enclosures (parentheses etc.)
		this.inArray = inArray;
	}

	// ----- low level -----
	last() {
		return this.out[this.out.length - 1];
	}
	atWordStart() {
		const l = this.last();
		return (
			this.out === '' ||
			l === ' ' ||
			l === '\n' ||
			(l === '-' && (this.out.length === 1 || this.out[this.out.length - 2] === ' '))
		);
	}
	/** Print a return-to-level indicator if one is owed. */
	flushPending() {
		if (this.pending !== null) {
			this.out += levelStr(this.pending);
			this.pending = null;
		}
	}
	/** Called before emitting content. kind: content | close | comma | scriptcomma | end */
	resolve(kind) {
		if (this.needSpace) {
			this.needSpace = false;
			if (kind === 'content' || kind === 'scriptcomma') {
				if (this.pending !== null && this.level === '') this.pending = null; // a space is a baseline return
				if (this.out !== '' && this.last() !== ' ') this.out += ' ';
			}
		}
		if (this.pending !== null) {
			if ((kind === 'comma' || kind === 'end') && this.pending === '') this.pending = null;
			else this.flushPending();
		}
	}
	raw(s) {
		this.out += s;
	}
	/** Absolute level indicator: replaces any owed return. */
	indicator(path) {
		this.pending = null;
		this.out += path;
		this.level = path;
	}
	needSpaceBefore() {
		if (this.out !== '' && this.last() !== ' ' && this.last() !== '\n') this.needSpace = true;
	}

	// ----- sequences -----
	seq(nodes, { top = false } = {}) {
		const list = flatten(nodes);
		for (let i = 0; i < list.length; i++) {
			const n = list[i];
			const prev = list[i - 1];
			const next = list[i + 1];
			// 21.11: a horizontal run of comparison signs has `"` between the unspaced signs
			if (n.t === 'sym' && INVERSE[n.latex]?.rel && next && next.t === 'sym' && INVERSE[next.latex]?.rel) {
				let j = i;
				let braille = '';
				while (list[j] && list[j].t === 'sym' && INVERSE[list[j].latex]?.rel) {
					braille += (braille ? '"' : '') + INVERSE[list[j].latex].braille;
					j++;
				}
				this.needSpaceBefore();
				this.resolve('content');
				this.raw(braille);
				this.needSpace = true;
				i = j - 1;
				continue;
			}
			// mixed number: integer immediately followed by a numeric fraction
			if (isIntegerNum(n) && next && next.t === 'frac' && next.n.length === 1 && next.d.length === 1 &&
				isIntegerNum(flatten(next.n)[0]) && isIntegerNum(flatten(next.d)[0])) {
				this.number(n);
				this.resolve('content');
				this.raw('_?' + next.n[0].v + '/' + next.d[0].v + '_#');
				i++;
				continue;
			}
			if (n.t === 'id' && !n.style && top && !this.inArray) {
				const isComma = (x) => x && x.t === 'sym' && x.latex === ',';
				const edgeOk = (x) => !x || x.t === 'space' || isComma(x);
				const relNeighbor = [prev, next].some((x) => x && x.t === 'sym' && INVERSE[x.latex]?.rel);
				const afterFn = prev && prev.t === 'fn';
				if (edgeOk(prev) && edgeOk(next) && !relNeighbor && !afterFn) {
					this.letter(n, true);
					continue;
				}
			}
			this.node(n);
		}
	}

	node(n) {
		switch (n.t) {
			case 'num':
				return this.number(n);
			case 'id':
				return this.letter(n, false);
			case 'greek':
				return this.greek(n);
			case 'fn':
				this.resolve('content');
				this.raw(n.name);
				this.needSpace = true; // 18.4.1
				return;
			case 'sym':
				return this.sym(n.latex);
			case 'space':
				this.needSpace = this.out !== '';
				return;
			case 'fact':
				this.resolve('content');
				this.raw('&');
				return;
			case 'prime':
				this.resolve('content');
				this.raw("'".repeat(n.n));
				return;
			case 'frac':
				return this.frac(n);
			case 'binom':
				return this.binom(n);
			case 'sqrt':
				return this.sqrt(n);
			case 'group':
				return this.group(n);
			case 'acc':
				return this.accent(n);
			case 'big':
				return this.big(n, null, null);
			case 'script':
				return this.script(n);
			case 'stack':
			case 'under':
				return this.compoundRel(n);
			case 'matrix':
				throw new UnsupportedLatexError('a matrix inside a larger expression');
			default:
				throw new UnsupportedLatexError(`node ${n.t}`);
		}
	}

	// ----- atoms -----
	number(n) {
		this.resolve('content');
		if (n.style) {
			this.raw(TYPEFORM[n.style] + '#' + n.v);
			return;
		}
		// 3.4: no numeric indicator after the comma-space of a list inside an enclosure: `(1, 2)`
		const inList = this.depth > 0 && /, -?$/.test(this.out);
		if (this.atWordStart() && !inList) this.raw('#');
		this.raw(n.v);
	}

	letter(n, single) {
		this.resolve('content');
		const cap = n.v >= 'A' && n.v <= 'Z';
		const ch = n.v.toLowerCase();
		if (n.style === 'german') {
			this.raw('_' + (cap ? ',' : '') + ch);
		} else if (n.style) {
			this.raw(TYPEFORM[n.style] + ';' + (cap ? ',' : '') + ch);
		} else {
			this.raw((single ? ';' : '') + (cap ? ',' : '') + ch);
		}
	}

	greek(n) {
		this.resolve('content');
		const cell = n.alt ? GREEK_ALT_CELL[n.name] : GREEK_CELL[n.name];
		if (!cell) throw new UnsupportedLatexError(`Greek letter \\${n.name}`);
		const pre = n.style ? TYPEFORM[n.style] : '';
		this.raw(pre + (n.alt ? '.@' : '.') + (n.cap ? ',' : '') + cell);
	}

	sym(latex) {
		if (latex === ',') {
			if (this.level === '') {
				this.resolve('comma');
				this.raw(',');
				this.needSpace = true;
			} else {
				this.resolve('scriptcomma');
				this.raw('['); // contracted comma at a script level preserves the level (14.8.2)
			}
			return;
		}
		if (OPEN[latex] !== undefined) {
			this.resolve('content');
			this.raw(OPEN[latex]);
			return;
		}
		if (CLOSE[latex] !== undefined) {
			this.resolve('close');
			this.raw(CLOSE[latex]);
			return;
		}
		let entry;
		if (!INVERSE[latex] && latex.startsWith('\\not') && latex.length > 4) {
			const base = INVERSE[latex.slice(4)];
			if (!base || !base.rel) throw new UnsupportedLatexError(latex);
			entry = { braille: '/' + base.braille, rel: true };
		} else {
			entry = INVERSE[latex];
		}
		if (!entry) throw new UnsupportedLatexError(latex);
		if (entry.rel) {
			this.needSpaceBefore();
			this.resolve('content');
			this.raw(entry.braille);
			this.needSpace = true; // 21.13
			return;
		}
		if (latex === '\\angle') {
			this.resolve('content');
			this.raw(entry.braille);
			this.needSpace = true; // 4.5: the angle sign is followed by a space
			return;
		}
		if (entry.ellipsis) {
			this.needSpaceBefore();
			this.resolve('content');
			this.raw(entry.braille);
			this.needSpace = true;
			return;
		}
		this.resolve('content');
		this.raw(entry.braille);
	}

	// ----- compound comparison signs (21.9, 21.11, 21.5) -----
	/** \\overset{a}{b} of two comparison signs (stacked), or \\underset{=}{R}. */
	compoundRel(n) {
		const relOf = (nodes) => {
			const l = flatten(nodes);
			if (l.length !== 1 || l[0].t !== 'sym') throw new UnsupportedLatexError('\\overset/\\underset on something other than a comparison sign');
			const e = INVERSE[l[0].latex];
			if (!e || !e.rel) throw new UnsupportedLatexError(`\\overset/\\underset on ${l[0].latex}`);
			return e.braille;
		};
		let braille;
		if (n.t === 'stack') braille = relOf(n.top) + relOf(n.bottom);
		else {
			const under = flatten(n.under);
			if (!(under.length === 1 && under[0].t === 'sym' && under[0].latex === '=')) {
				throw new UnsupportedLatexError('\\underset with something other than "="');
			}
			braille = relOf(n.base) + '.k';
		}
		this.needSpaceBefore();
		this.resolve('content');
		this.raw(braille);
		this.needSpace = true;
	}

	// ----- structures -----
	frac(n) {
		const depth = fracDepth(n);
		if (depth > 3) throw new UnsupportedLatexError('fractions nested deeper than hypercomplex');
		const [open, line, close] = [
			['?', '/', '#'],
			[',?', ',/', ',#'],
			[',,?', ',,/', ',,#']
		][depth - 1];
		this.resolve('content');
		this.raw(open);
		this.seq(n.n);
		this.resolve('close');
		this.raw(line);
		this.seq(n.d);
		this.resolve('close');
		this.raw(close);
	}

	binom(n) {
		this.resolve('content');
		this.raw('(');
		this.seq(n.n);
		this.resolve('close');
		this.raw('%');
		this.seq(n.d);
		this.resolve('close');
		this.raw(')');
	}

	sqrt(n) {
		const dots = '.'.repeat(this.radDepth);
		this.resolve('content');
		if (n.idx) {
			this.raw(dots + '<'); // order dots come before the index (11.6)
			this.seq(n.idx);
			this.resolve('close');
			this.raw('>');
		} else {
			this.raw(dots + '>');
		}
		this.radDepth++;
		this.seq(n.body);
		this.radDepth--;
		this.resolve('close');
		this.raw(dots + ']');
	}

	group(n) {
		let open;
		let close;
		if (n.enlarged) {
			open = n.open === null ? '' : (ENLARGED_OPEN[n.open] ?? OPEN[n.open] ?? (n.open === '|' ? '\\' : undefined));
			close = n.close === null ? '' : (ENLARGED_CLOSE[n.close] ?? CLOSE[n.close] ?? (n.close === '|' ? '\\' : undefined));
		} else {
			open = OPEN[n.open];
			close = CLOSE[n.close];
		}
		if (open === undefined || close === undefined) throw new UnsupportedLatexError(`delimiter ${n.open} ${n.close}`);
		this.resolve('content');
		this.raw(open);
		this.depth++;
		this.seq(n.body);
		this.depth--;
		this.resolve('close');
		this.raw(close);
	}

	/** 15.2: modified expressions. */
	accent(n) {
		const body = flatten(n.body);
		const single = body.length === 1 && (body[0].t === 'id' || (body[0].t === 'num' && /^\.?\d$/.test(body[0].v)));
		const under = n.kind === 'ubar';
		if (under && body.length === 1 && body[0].t === 'sym' && INVERSE[body[0].latex]?.rel) {
			this.needSpaceBefore();
			this.resolve('content');
			this.raw(INVERSE[body[0].latex].braille + ':');
			this.needSpace = true;
			return;
		}
		const mod = under ? ':' : ACCENT[n.kind];
		if (!mod) throw new UnsupportedLatexError(`accent ${n.kind}`);
		if (single && (n.kind === 'bar' || under)) {
			// contracted form: x: (bar over) / x%: (bar under)
			this.node(body[0].t === 'num' ? { ...body[0] } : body[0].style ? body[0] : { ...body[0] });
			this.resolve('content');
			this.raw(under ? '%:' : ':');
			return;
		}
		this.resolve('content');
		if (this.level !== '' && !this.out.endsWith(this.level)) this.raw(this.level);
		this.raw('"');
		this.seq(n.body);
		this.resolve('close');
		this.raw((under ? '%' : '<') + mod + ']');
	}

	/**
	 * Limits written directly under/over the sign take the modifier form (15, ex 21-27; 11.9,
	 * ex 5-6): \sum and \prod by default, \int and friends only after \limits. Otherwise the
	 * limits are ordinary scripts (11.9, ex 7-9).
	 */
	big(n, sub, sup) {
		const sign = { sum: '.,s', prod: '.,p', int: '!', iint: '!!', iiint: '!!!', oint: '!@$c]' }[n.name];
		if ((sub || sup) && stackedLimits(n)) {
			this.resolve('content');
			if (this.level !== '' && !this.out.endsWith(this.level)) this.raw(this.level);
			this.raw('"' + sign);
			if (sub) {
				this.raw('%');
				this.seq(sub);
				this.resolve('close');
			}
			if (sup) {
				this.raw('<');
				this.seq(sup);
				this.resolve('close');
			}
			this.raw(']');
			return;
		}
		this.resolve('content');
		this.raw(sign);
	}

	script(n) {
		const L = this.level;
		const base = n.base && flatten([n.base]);
		const sub = n.sub;
		const sup = n.sup;
		const only = base && base.length === 1 ? base[0] : null;

		// big operators and limit functions with limits take the modifier form
		if (only && only.t === 'big' && stackedLimits(only)) return this.big(only, sub, sup);
		if (only && only.t === 'fn' && LIMIT_FUNCTIONS.has(only.name) && sub && !sup) {
			this.resolve('content');
			if (L !== '' && !this.out.endsWith(L)) this.raw(L);
			this.raw('"' + only.name + '%');
			this.seq(sub);
			this.resolve('close');
			this.raw(']');
			this.needSpace = true;
			return;
		}

		let baseWasFn = false;
		if (base === null) {
			// left script: a baseline return owed from a right script must be printed first (14.5.2)
			this.flushPending();
		} else {
			for (const b of base.slice(0, -1)) this.node(b);
			const lastBase = base[base.length - 1];
			if (lastBase.t === 'script') throw new UnsupportedLatexError('nested script without grouping');
			this.node(lastBase);
			baseWasFn = lastBase.t === 'fn';
		}

		const savedSpace = this.needSpace;
		this.needSpace = false;
		const subs = sub ? flatten(sub) : null;
		const numericSub =
			subs && subs.length === 1 && isIntegerNum(subs[0]) && L === '' && only && NUMERIC_BASE_OK.has(only.t) &&
			!(only.t === 'id' && only.style);

		let owesReturn = true;
		if (sub) {
			if (numericSub) {
				this.raw(subs[0].v); // 14.6: no subscript indicator; 14.10.1: no baseline return
				owesReturn = false;
			} else {
				this.indicator(L + ';');
				this.seq(sub);
				this.level = L + ';';
			}
		}
		if (sup) {
			this.indicator(L + '^');
			this.seq(sup);
			owesReturn = true;
		}
		this.level = L;
		this.pending = owesReturn ? L : null;
		this.needSpace = savedSpace || baseWasFn;
	}
}

/** Pad aligned columns for a matrix (25.8.1: entries left-justified, one blank column between). */
function matrixLines(n) {
	const fences = { p: [',(', ',)'], b: ['@,(', '@,)'], v: ['\\', '\\'], V: ['\\\\', '\\\\'] }[n.env];
	const cells = n.rows.map((row) =>
		row.map((cell) => {
			const g = new Gen({ inArray: true });
			g.seq(cell);
			g.resolve('end');
			return g.out.trimEnd();
		})
	);
	const cols = Math.max(...cells.map((r) => r.length));
	const widths = Array.from({ length: cols }, (_, c) => Math.max(...cells.map((r) => (r[c] ?? '').length)));
	return cells.map((r) => {
		const text = widths
			.map((w, c) => (r[c] ?? '').padEnd(w))
			.join(' ')
			.trimEnd();
		return fences[0] + text.padEnd(widths.reduce((a, b) => a + b, 0) + cols - 1) + fences[1];
	});
}

/**
 * Translate LaTeX math to Nemeth (ASCII braille). Multi-line results (matrices) are
 * returned with a leading and trailing newline so that `'_%' + result + '_:'` has the
 * layout the code prescribes.
 * @param {string} latex math without $ delimiters
 * @returns {string}
 * @throws {UnsupportedLatexError}
 */
/** Big operator whose limits sit directly under/over it (see Gen.big). */
function stackedLimits(n) {
	if (n.t !== 'big') return false;
	return n.limits === true || ((n.name === 'sum' || n.name === 'prod') && n.limits !== false);
}

export function latexToNemeth(latex) {
	const nodes = flatten(parseLatex(latex)).filter((n, i, a) => !(n.t === 'space' && (i === 0 || i === a.length - 1)));
	if (nodes.length === 1 && nodes[0].t === 'matrix') {
		return '\n' + matrixLines(nodes[0]).join('\n') + '\n';
	}
	const g = new Gen();
	g.seq(nodes, { top: true });
	g.resolve('end');
	return g.out.trimEnd();
}

export { UnsupportedLatexError };
