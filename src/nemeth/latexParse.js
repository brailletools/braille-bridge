// LaTeX math -> AST, for the LaTeX -> Nemeth direction.
//
// This parser is deliberately strict: any command or construct it does not know raises
// an UnsupportedLatexError rather than being guessed at. (The Abraham translator this
// replaces turned unknown LaTeX into plausible-looking garbage such as
// "BEGIN MATRIX ..." or "XIN", which is worse than an error because it silently
// corrupts the braille pane. Callers catch the error and leave the braille untouched.)
//
// Node shapes (all have `t`):
//   num {v}   id {v, style}   greek {name, cap, alt}   fn {name}
//   sym {latex}        operator / relation / punctuation by LaTeX spelling (see toNemeth)
//   frac {n, d}  binom {n, d}  sqrt {idx, body}
//   group {open, close, body, enlarged}
//   script {base, sub, sup}      base === null means a LEFT script (`{}^a x`)
//   acc {kind, body}             accents / bars / vectors
//   big {name}                   \sum \prod \int ... (limits arrive as a script around it)
//   matrix {env, rows}           rows: Node[][][]
//   prime {n}   fact {}   space {}

export class UnsupportedLatexError extends Error {
	constructor(what) {
		super(`Unsupported LaTeX: ${what}`);
		this.name = 'UnsupportedLatexError';
	}
}

export const FUNCTION_COMMANDS = new Set([
	'arccos',
	'arcsin',
	'arctan',
	'arg',
	'cos',
	'cosh',
	'cot',
	'coth',
	'csc',
	'deg',
	'det',
	'dim',
	'exp',
	'gcd',
	'hom',
	'inf',
	'ker',
	'lg',
	'lim',
	'liminf',
	'limsup',
	'ln',
	'log',
	'max',
	'min',
	'sec',
	'sin',
	'sinh',
	'sup',
	'tan',
	'tanh'
]);

const GREEK_LOWER = new Set(
	'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi pi rho sigma tau upsilon phi chi psi omega'.split(
		' '
	)
);
const GREEK_UPPER = new Set('Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega'.split(' '));
const GREEK_ALT = new Set(['varepsilon', 'vartheta', 'varphi', 'varpi', 'varrho', 'varsigma']);

const BIG = new Set(['sum', 'prod', 'int', 'iint', 'iiint', 'oint']);

const ACCENTS = {
	overline: 'bar',
	bar: 'bar',
	underline: 'ubar',
	hat: 'hat',
	widehat: 'hat',
	tilde: 'tilde',
	widetilde: 'tilde',
	vec: 'vec',
	overrightarrow: 'vec',
	dot: 'dot',
	ddot: 'ddot',
	mathring: 'ring'
};

const STYLES = {
	mathbf: 'bold',
	boldsymbol: 'bold',
	bm: 'bold',
	mathit: 'italic',
	mathcal: 'script',
	mathscr: 'script',
	mathbb: 'barred',
	mathsf: 'sans',
	mathfrak: 'german',
	mathrm: null // regular type: identical to plain letters
};

const IGNORED = new Set([
	'displaystyle',
	'textstyle',
	'scriptstyle',
	'limits',
	'nolimits',
	'left.',
	'right.',
	'!',
	',',
	';',
	':',
	'>',
	'thinspace',
	'medspace',
	'thickspace',
	'negthinspace',
	'bigl',
	'bigr',
	'Bigl',
	'Bigr'
]);
const SPACES = new Set([' ', 'quad', 'qquad', 'enspace']);

// Control symbols that are literal characters.
const LITERAL_CONTROL = { '{': '\\{', '}': '\\}', '|': '\\|', '%': '\\%', $: '\\$', '#': '\\#', '&': '\\&' };

const OPEN = new Set(['(', '[', '\\{', '\\langle', '\\lfloor', '\\lceil', '\\lbrack']);
const CLOSE = new Set([')', ']', '\\}', '\\rangle', '\\rfloor', '\\rceil', '\\rbrack']);

/** Tokenize into commands, braces and single characters. */
function tokenize(src) {
	const toks = [];
	let i = 0;
	while (i < src.length) {
		const c = src[i];
		if (c === '\\') {
			const m = /^\\([A-Za-z]+)/.exec(src.slice(i));
			if (m) {
				toks.push({ k: 'cmd', v: m[1] });
				i += m[0].length;
			} else {
				toks.push({ k: 'ctl', v: src[i + 1] ?? '' });
				i += 2;
			}
		} else if (/\s/.test(c)) {
			let j = i;
			while (j < src.length && /\s/.test(src[j])) j++;
			toks.push({ k: 'ws' });
			i = j;
		} else {
			toks.push({ k: 'ch', v: c });
			i++;
		}
	}
	return toks;
}

class P {
	constructor(src) {
		this.toks = tokenize(src);
		this.p = 0;
	}
	peek(o = 0) {
		return this.toks[this.p + o];
	}
	eof() {
		return this.p >= this.toks.length;
	}
	isCh(v, o = 0) {
		const t = this.peek(o);
		return t && t.k === 'ch' && t.v === v;
	}
	skipWs() {
		while (this.peek() && this.peek().k === 'ws') this.p++;
	}

	/** Parse nodes until `}` / `\end` / `&` / `\\` (not consumed) or EOF. */
	seq(stopAtClose = false) {
		const nodes = [];
		while (!this.eof()) {
			const t = this.peek();
			if (t.k === 'ch' && (t.v === '}' || t.v === '&')) break;
			if (t.k === 'cmd' && t.v === 'end') break;
			if (t.k === 'ctl' && t.v === '\\') break;
			if (t.k === 'cmd' && t.v === 'right') break;
			if (stopAtClose && t.k === 'ch' && CLOSE.has(t.v)) break;
			if (stopAtClose && t.k === 'ctl' && CLOSE.has('\\' + t.v)) break;
			if (stopAtClose && t.k === 'cmd' && CLOSE.has('\\' + t.v)) break;
			const atom = this.atomWithScripts();
			if (atom) nodes.push(atom);
		}
		return nodes;
	}

	/** One brace group `{...}` or a single token as an argument. */
	arg() {
		this.skipWs();
		const t = this.peek();
		if (!t) throw new UnsupportedLatexError('missing argument');
		if (t.k === 'ch' && t.v === '{') {
			this.p++;
			const body = this.seq();
			if (!this.isCh('}')) throw new UnsupportedLatexError('unbalanced braces');
			this.p++;
			return body;
		}
		const a = this.atom();
		return a ? [a] : [];
	}

	atomWithScripts() {
		const t = this.peek();
		// left scripts: `{}^a x` -- an empty group carrying scripts
		let base = null;
		let hadEmptyGroup = false;
		if (t.k === 'ch' && t.v === '{' && this.peek(1)?.k === 'ch' && this.peek(1).v === '}') {
			this.p += 2;
			hadEmptyGroup = true;
		} else {
			base = this.atom();
			if (base === null) return null;
		}
		let primes = 0;
		while (this.isCh("'")) {
			primes++;
			this.p++;
		}
		let sub = null;
		let sup = null;
		for (;;) {
			this.skipWsBeforeScript();
			if (this.isCh('^') && sup === null) {
				this.p++;
				sup = this.arg();
			} else if (this.isCh('_') && sub === null) {
				this.p++;
				sub = this.arg();
			} else break;
		}
		// sup consisting only of primes is a prime
		if (sup && sup.length && sup.every((n) => n.t === 'sym' && n.latex === '\\prime')) {
			primes += sup.length;
			sup = null;
		}
		if (primes) base = { t: 'seqnode', nodes: [base, { t: 'prime', n: primes }] };
		if (!sub && !sup) {
			if (hadEmptyGroup) return null;
			return base;
		}
		return { t: 'script', base: hadEmptyGroup ? null : base, sub, sup };
	}
	skipWsBeforeScript() {
		let o = 0;
		while (this.peek(o) && this.peek(o).k === 'ws') o++;
		const t = this.peek(o);
		if (t && t.k === 'ch' && (t.v === '^' || t.v === '_')) this.p += o;
	}

	atom() {
		const t = this.peek();
		if (!t) return null;
		this.p++;

		if (t.k === 'ws') return null; // whitespace carries no meaning in math mode

		if (t.k === 'ch') {
			const c = t.v;
			if (/[0-9]/.test(c)) return this.number(c);
			if (/[A-Za-z]/.test(c)) return { t: 'id', v: c, style: null };
			if (c === '{') {
				const body = this.seq();
				if (!this.isCh('}')) throw new UnsupportedLatexError('unbalanced braces');
				this.p++;
				return { t: 'seqnode', nodes: body };
			}
			if (c === '~') return { t: 'space' };
			if (c === '!') return { t: 'fact' };
			if (OPEN.has(c)) return this.group(c);
			if (CLOSE.has(c)) return { t: 'sym', latex: c };
			if ('+-=<>,.:|/*'.includes(c)) return { t: 'sym', latex: c };
			if (c === "'") return { t: 'prime', n: 1 };
			if (c === '^' || c === '_') throw new UnsupportedLatexError('script with no base');
			throw new UnsupportedLatexError(`character ${JSON.stringify(c)}`);
		}

		if (t.k === 'ctl') {
			const v = t.v;
			// thin/medium/thick spaces are real spaces in print (e.g. the one in `x\\,dx`)
			if (v === ',' || v === ';' || v === ':' || v === '>' || v === ' ') return { t: 'space' };
			if (v === '!') return null;
			if (v in LITERAL_CONTROL) {
				const lit = LITERAL_CONTROL[v];
				if (lit === '\\{') return this.group('\\{');
				if (lit === '\\}') return { t: 'sym', latex: '\\}' };
				return { t: 'sym', latex: lit };
			}
			throw new UnsupportedLatexError(`\\${v}`);
		}

		// commands
		const name = t.v;
		if (IGNORED.has(name)) return null;
		if (SPACES.has(name)) return { t: 'space' };
		if (name === 'left') return this.left();
		if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
			const n = this.arg();
			const d = this.arg();
			return { t: 'frac', n, d };
		}
		if (name === 'binom' || name === 'dbinom' || name === 'tbinom') {
			const n = this.arg();
			const d = this.arg();
			return { t: 'binom', n, d };
		}
		if (name === 'sqrt') {
			let idx = null;
			this.skipWs();
			if (this.isCh('[')) {
				this.p++;
				idx = this.seq(true);
				if (!this.isCh(']')) throw new UnsupportedLatexError('unterminated radical index');
				this.p++;
			}
			return { t: 'sqrt', idx, body: this.arg() };
		}
		if (name === 'overset' || name === 'stackrel') {
			const top = this.arg();
			const bottom = this.arg();
			return { t: 'stack', top, bottom };
		}
		if (name === 'underset') {
			const under = this.arg();
			const base = this.arg();
			return { t: 'under', under, base };
		}
		if (name in ACCENTS) return { t: 'acc', kind: ACCENTS[name], body: this.arg() };
		if (name in STYLES) return this.styled(STYLES[name], this.arg());
		if (FUNCTION_COMMANDS.has(name)) return { t: 'fn', name };
		if (name === 'operatorname') {
			const body = this.arg();
			const word = body.map((n) => (n.t === 'id' ? n.v : '')).join('');
			if (!word || body.some((n) => n.t !== 'id')) throw new UnsupportedLatexError('\\operatorname argument');
			return { t: 'fn', name: word.toLowerCase() };
		}
		if (GREEK_LOWER.has(name)) return { t: 'greek', name, cap: false, alt: false };
		if (GREEK_UPPER.has(name)) return { t: 'greek', name: name.toLowerCase(), cap: true, alt: false };
		if (GREEK_ALT.has(name)) return { t: 'greek', name: name.slice(3), cap: false, alt: true };
		if (BIG.has(name)) return { t: 'big', name };
		if (name === 'not') {
			this.skipWs();
			const nxt = this.atom();
			if (!nxt || nxt.t !== 'sym') throw new UnsupportedLatexError('\\not applied to a non-symbol');
			return { t: 'sym', latex: '\\not' + nxt.latex };
		}
		if (name === 'begin') return this.environment();
		if (name === 'text' || name === 'mbox' || name === 'textrm') {
			throw new UnsupportedLatexError('\\' + name + ' (literary text inside math is not supported yet)');
		}
		if (name === 'prime') return { t: 'sym', latex: '\\prime' };
		return { t: 'sym', latex: '\\' + name };
	}

	number(first) {
		let v = first;
		for (;;) {
			const c = this.peek();
			if (c && c.k === 'ch' && /[0-9]/.test(c.v)) {
				v += c.v;
				this.p++;
			} else if (c && c.k === 'ch' && c.v === '.' && this.peek(1)?.k === 'ch' && /[0-9]/.test(this.peek(1).v)) {
				v += '.';
				this.p++;
			} else if (
				c &&
				c.k === 'ch' &&
				c.v === ',' &&
				/^\d\d\d(?!\d)/.test(
					this.toks
						.slice(this.p + 1, this.p + 5)
						.map((x) => (x.k === 'ch' ? x.v : '#'))
						.join('')
				)
			) {
				v += ',';
				this.p++;
			} else if (
				c &&
				c.k === 'ch' &&
				c.v === '{' &&
				this.peek(1)?.v === ',' &&
				this.peek(2)?.v === '}' &&
				this.peek(3)?.k === 'ch' &&
				/[0-9]/.test(this.peek(3).v)
			) {
				v += ',';
				this.p += 3; // `1{,}000`
			} else break;
		}
		return { t: 'num', v };
	}

	styled(style, body) {
		// style applies to each letter / digit run inside
		const apply = (n) => {
			if (n.t === 'id') return { ...n, style };
			if (n.t === 'greek') return { ...n, style };
			if (n.t === 'num') return { ...n, style };
			if (n.t === 'seqnode') return { ...n, nodes: n.nodes.map(apply) };
			return n;
		};
		return { t: 'seqnode', nodes: body.map(apply) };
	}

	/** Open grouping symbol already consumed (as text `c`): parse to a matching close. */
	group(openSym) {
		const save = this.p;
		const body = this.seq(true);
		const t = this.peek();
		let closeSym = null;
		if (t && t.k === 'ch' && CLOSE.has(t.v)) closeSym = t.v;
		else if (t && t.k === 'ctl' && CLOSE.has('\\' + t.v)) closeSym = '\\' + t.v;
		else if (t && t.k === 'cmd' && CLOSE.has('\\' + t.v)) closeSym = '\\' + t.v;
		if (closeSym === null) {
			// unbalanced open: treat as a lone symbol
			this.p = save;
			return { t: 'sym', latex: openSym };
		}
		this.p++;
		return { t: 'group', open: openSym, close: closeSym, body, enlarged: false };
	}

	/** \left X ... \right Y */
	left() {
		const delim = () => {
			const t = this.peek();
			this.p++;
			if (!t) throw new UnsupportedLatexError('\\left/\\right without delimiter');
			if (t.k === 'ch') return t.v === '.' ? null : t.v;
			if (t.k === 'ctl') return '\\' + t.v;
			if (t.k === 'cmd') return '\\' + t.v;
			throw new UnsupportedLatexError('delimiter');
		};
		this.skipWs();
		const open = delim();
		const body = this.seq();
		const t = this.peek();
		if (!(t && t.k === 'cmd' && t.v === 'right')) throw new UnsupportedLatexError('\\left without \\right');
		this.p++;
		this.skipWs();
		const close = delim();
		return { t: 'group', open, close, body, enlarged: true };
	}

	environment() {
		const name = this.envName();
		const kinds = { pmatrix: 'p', bmatrix: 'b', vmatrix: 'v', Vmatrix: 'V' };
		if (!(name in kinds)) throw new UnsupportedLatexError(`environment ${name}`);
		const rows = [[[]]];
		for (;;) {
			const cell = this.seq();
			rows[rows.length - 1][rows[rows.length - 1].length - 1] = cell;
			const t = this.peek();
			if (!t) throw new UnsupportedLatexError(`unterminated environment ${name}`);
			if (t.k === 'ch' && t.v === '&') {
				this.p++;
				rows[rows.length - 1].push([]);
			} else if (t.k === 'ctl' && t.v === '\\') {
				this.p++;
				rows.push([[]]);
			} else if (t.k === 'cmd' && t.v === 'end') {
				this.p++;
				const endName = this.envName();
				if (endName !== name) throw new UnsupportedLatexError(`\\end{${endName}} closes \\begin{${name}}`);
				break;
			} else throw new UnsupportedLatexError('malformed environment');
		}
		// drop a trailing empty row produced by a final `\\`
		const last = rows[rows.length - 1];
		if (last.length === 1 && last[0].length === 0 && rows.length > 1) rows.pop();
		return { t: 'matrix', env: kinds[name], rows };
	}
	envName() {
		this.skipWs();
		if (!this.isCh('{')) throw new UnsupportedLatexError('\\begin/\\end without a name');
		this.p++;
		let n = '';
		while (this.peek() && !this.isCh('}')) {
			n += this.peek().v ?? '';
			this.p++;
		}
		this.p++;
		return n;
	}
}

/** @param {string} src LaTeX math (no $ delimiters) @returns {object[]} AST */
export function parseLatex(src) {
	const p = new P(src);
	const nodes = p.seq();
	if (!p.eof()) throw new UnsupportedLatexError('unbalanced braces or stray `&`/`\\\\`');
	return nodes;
}
