// Symbol tables for the Nemeth Braille Code (BANA 2022 revision), in ASCII braille.
//
// Source of truth: "The Nemeth Braille Code for Mathematics and Science Notation,
// 2022" (Braille Authority of North America), Rule 2 (indicators) and Appendix D
// (Index of Nemeth Braille Symbols). These tables were written from that document,
// NOT copied from any other translator's tables.
//
// All keys are in normalized ASCII braille (see normalize() in toLatex.js):
// lowercase letters, `^` for dots 45, `_` for dots 456, `@` for dot 4 (the
// backtick alias is folded into it), `[ \ ]` for `{ | }`.
//
// Entry shape: { latex, rel?: true }
//   rel  -- a comparison sign. Rule 21 requires a space before and after, which is
//           the ONLY thing that separates e.g. `.k` ("=") from Greek kappa (`.` + k),
//           so rel symbols are recognized only when space-delimited.
//   op   -- a binary operation sign (emitted with surrounding thin space by LaTeX).

/** Symbols made only of punctuation / digits-free cells, matched longest-first. */
export const SYMBOLS = {
	// --- operations (Rule 20) ---
	'+': { latex: '+' },
	'-': { latex: '-' },
	'+-': { latex: '\\pm' },
	'-+': { latex: '\\mp' },
	'*': { latex: '\\cdot' }, // dot / multiplication dot
	'@*': { latex: '\\times' }, // cross
	'./': { latex: '\\div' }, // division sign
	'_/': { latex: '/' }, // slash (per, over)
	'_*': { latex: '\\backslash' },
	'@%': { latex: '\\wedge' }, // logical product
	'@+': { latex: '\\vee' }, // logical sum
	'.%': { latex: '\\cap' }, // intersection
	'.+': { latex: '\\cup' }, // union
	'.*': { latex: '\\circ' }, // hollow dot
	'_&': { latex: '\\&' },
	'@#': { latex: '\\ast' }, // asterisk
	'_]': { latex: '\\dagger' },
	'__]': { latex: '\\ddagger' },
	'@,s': { latex: '\\S' },
	'@,p': { latex: '\\P' },

	// --- comparison (Rule 21); rel: only when space-delimited ---
	'.k': { latex: '=', rel: true },
	'/.k': { latex: '\\neq', rel: true },
	'"k': { latex: '<', rel: true },
	'.1': { latex: '>', rel: true },
	'"k:': { latex: '\\leq', rel: true },
	'.1:': { latex: '\\geq', rel: true },
	'"k.k': { latex: '\\leqq', rel: true },
	'.1.k': { latex: '\\geqq', rel: true },
	'@e': { latex: '\\in', rel: true },
	'@5': { latex: '\\ni', rel: true },
	'_"k': { latex: '\\subset', rel: true },
	'_"k:': { latex: '\\subseteq', rel: true },
	'_.1': { latex: '\\supset', rel: true },
	'_.1:': { latex: '\\supseteq', rel: true },
	'_l': { latex: '\\equiv', rel: true },
	'@:': { latex: '\\sim', rel: true },
	'@:@:': { latex: '\\approx', rel: true },
	'@::': { latex: '\\simeq', rel: true },
	'"1': { latex: ':', rel: true }, // ratio
	'_=': { latex: '\\propto', rel: true },
	'$l': { latex: '\\parallel', rel: true },
	'$p': { latex: '\\perp', rel: true },
	'/$l': { latex: '\\nparallel', rel: true },
	'$o': { latex: '\\to', rel: true }, // contracted right arrow
	'$33o': { latex: '\\to', rel: true },
	'${33': { latex: '\\leftarrow', rel: true },
	'${33o': { latex: '\\leftrightarrow', rel: true },
	'$<33o': { latex: '\\uparrow', rel: true },
	'$%33o': { latex: '\\downarrow', rel: true },
	'$<{33o': { latex: '\\updownarrow', rel: true },
	'@/': { latex: '\\because', rel: true },
	'$77o': { latex: '\\Rightarrow', rel: true },
	'${77': { latex: '\\Leftarrow', rel: true },
	'${77o': { latex: '\\Leftrightarrow', rel: true },
	'$333o': { latex: '\\longrightarrow', rel: true },
	'${333': { latex: '\\longleftarrow', rel: true },
	'${333o': { latex: '\\longleftrightarrow', rel: true },
	'$777o': { latex: '\\Longrightarrow', rel: true },
	'${777': { latex: '\\Longleftarrow', rel: true },
	'${777o': { latex: '\\Longleftrightarrow', rel: true },
	'$33o$[33': { latex: '\\rightleftarrows', rel: true },

	// --- quantifiers, calculus, misc (Rule 23) ---
	'@&': { latex: '\\forall' },
	'@=': { latex: '\\exists' },
	'@d': { latex: '\\partial' },
	'@h': { latex: '\\hbar' },
	'_0': { latex: '\\emptyset' },
	',=': { latex: '\\infty' },
	'!': { latex: '\\int' },
	'!!': { latex: '\\iint' },
	'!!!': { latex: '\\iiint' },
	'@a': { latex: '@' },
	'@l': { latex: '\\pounds' },
	'@0': { latex: '\\%' },
	'@00': { latex: '\\permil' },
	'@s': { latex: '\\$' },
	'@c': { latex: '\\textcent' },
	'@,a': { latex: '\\AA' },
	'.$': { latex: '\\nabla' },
	'.#': { latex: '\\#' },
	'.-': { latex: '\\dot{-}' }, // proper difference

	// --- shapes (Rule 17) ---
	'${': { latex: '\\angle' },
	'${.r]': { latex: '\\llcorner' }, // right angle
	'${.o]': { latex: '\\angle' }, // obtuse
	'${.s]': { latex: '\\angle' }, // straight
	'$t.a]': { latex: '\\triangle' }, // acute / isosceles / obtuse / right / scalene
	'$t.i]': { latex: '\\triangle' },
	'$t.o]': { latex: '\\triangle' },
	'$t.r]': { latex: '\\triangle' },
	'$t.s]': { latex: '\\triangle' },
	'$h': { latex: '\\lozenge' },
	"$'": { latex: '\\smile' },
	'$a': { latex: '\\frown' },
	'$c_$*]': { latex: '\\odot' },
	'$c_$+]': { latex: '\\oplus' },
	'$c_$-]': { latex: '\\ominus' },
	'$c_$@*]': { latex: '\\otimes' },
	'$4_$*]': { latex: '\\boxdot' },
	'!@$c]': { latex: '\\oint' },
	'$t': { latex: '\\triangle' },
	'$c': { latex: '\\bigcirc' },
	'$r': { latex: '\\square' }, // rectangle drawn as a box; best plain LaTeX has
	'$4': { latex: '\\square' },
	'$d': { latex: '\\diamond' },
	'$s': { latex: '\\star' },
	'$q': { latex: '\\square' },

	// --- ellipsis / dashes ---
	"'''": { latex: '\\ldots' },
	'----': { latex: '\\text{---}' },
	'--': { latex: '\\text{--}' },

	// --- vertical bars (grouping or "divides") ---
	'\\': { latex: '|' },
	'\\\\': { latex: '\\|' }
};

/** Grouping symbols (Rule 19): open/close pairs. */
export const GROUPS = {
	'(': '(',
	')': ')',
	'@(': '[',
	'@)': ']',
	'.(': '\\{',
	'.)': '\\}',
	'..(': '\\langle ',
	'..)': '\\rangle ',
	'@_(': '[\\![',
	'@_)': ']\\!]',
	'@,(': '[',
	'@,)': ']',
	// ceiling / floor (Rule 19 half-brackets, used for these in practice)
	',(': '\\bigl(',
	',)': '\\bigr)',
	'.,(': '\\bigl\\{',
	'.,)': '\\bigr\\}',
	'@^(': '\\lceil ',
	'@^)': '\\rceil ',
	'@;(': '\\lfloor ',
	'@;)': '\\rfloor '
};

/** Greek letters by the lower-case Latin cell that follows the Greek indicator (`.`). */
export const GREEK = {
	a: 'alpha',
	b: 'beta',
	g: 'gamma',
	d: 'delta',
	e: 'epsilon',
	z: 'zeta',
	':': 'eta',
	'?': 'theta',
	i: 'iota',
	k: 'kappa',
	l: 'lambda',
	m: 'mu',
	n: 'nu',
	x: 'xi',
	o: 'o', // omicron has no LaTeX command
	p: 'pi',
	r: 'rho',
	s: 'sigma',
	t: 'tau',
	u: 'upsilon',
	f: 'phi',
	'&': 'chi',
	y: 'psi',
	w: 'omega'
};
/** Greek "alternative" letters (indicator `.@`). */
export const GREEK_ALT = {
	e: '\\varepsilon',
	'?': '\\vartheta',
	f: '\\varphi',
	p: '\\varpi',
	r: '\\varrho',
	s: '\\varsigma',
	k: '\\varkappa'
};
/** Capital Greek that have a distinct LaTeX command (the rest equal Latin capitals). */
export const GREEK_CAPITAL = new Set([
	'gamma',
	'delta',
	'theta',
	'lambda',
	'xi',
	'pi',
	'sigma',
	'upsilon',
	'phi',
	'psi',
	'omega'
]);

/** Abbreviated function names (Rule 18 / Appendix D); matched as whole letter runs. */
export const FUNCTIONS = new Set([
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
/** Functions Nemeth abbreviates/lists that LaTeX has no operator for: rendered via \operatorname. */
export const OPERATORNAME_FUNCTIONS = new Set([
	'amp',
	'antilog',
	'arc',
	'colog',
	'covers',
	'csch',
	'ctn',
	'ctnh',
	'erf',
	'exsec',
	'grad',
	'hav',
	'im',
	'mod',
	're',
	'sech',
	'vers'
]);

/** Modifier symbols (Rule 15): braille after `<` (over) / `%` (under) -> LaTeX builders. */
export const MODIFIERS = {
	over: {
		':': (x) => `\\overline{${x}}`, // bar
		'@:': (x) => `\\tilde{${x}}`,
		'_<': (x) => `\\hat{${x}}`,
		'.*': (x) => `\\mathring{${x}}`,
		'*': (x) => `\\dot{${x}}`,
		'**': (x) => `\\ddot{${x}}`,
		'***': (x) => `\\dddot{${x}}`,
		'$33o': (x) => `\\overrightarrow{${x}}`,
		'$o': (x) => `\\overrightarrow{${x}}`,
		'${33': (x) => `\\overleftarrow{${x}}`,
		'${33o': (x) => `\\overleftrightarrow{${x}}`,
		$a: (x) => `\\overset{\\frown}{${x}}`,
		'.k': (x) => `\\overset{=}{${x}}`,
		"'": (x) => `${x}'`
	},
	under: {
		':': (x) => `\\underline{${x}}`,
		'@:': (x) => `\\underset{\\sim}{${x}}`,
		'_<': (x) => `\\underset{\\wedge}{${x}}`,
		'$33o': (x) => `\\underrightarrow{${x}}`,
		$a: (x) => `\\underset{\\frown}{${x}}`,
		"$'": (x) => `\\underset{\\smile}{${x}}`
	}
};
