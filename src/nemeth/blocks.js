// Block-level Nemeth: spatial arrangements that span several braille lines.
//
// Currently implemented: matrices and determinants (Nemeth Code 2022, Rule 25.8).
// Each row is a braille line wrapped in an enlarged grouping symbol; entries are
// left-justified in their column with one blank column between columns (25.8.1).
//
// Column detection: a column boundary is a character position that is blank in EVERY
// row. This is exact for the layout the code requires, but cannot be recovered from a
// single row, so at least two consecutive rows are needed to call something an array.
// Known limitations (the block is left to the single-line translator in these cases):
// entries that run over onto continuation lines (25.8.2 b/c), spatially drawn
// fractions (25.8.2 e), and several matrices side by side on one row (e.g. A*B).

import { normalize } from './toLatex.js';
import { FUNCTIONS, OPERATORNAME_FUNCTIONS } from './symbols.js';

const isFunctionName = (w) => FUNCTIONS.has(w) || OPERATORNAME_FUNCTIONS.has(w);

// [open, close, LaTeX environment]
const FENCES = [
	['@,(', '@,)', 'bmatrix'],
	[',(', ',)', 'pmatrix'],
	['\\\\', '\\\\', 'Vmatrix'],
	['\\', '\\', 'vmatrix']
];

/** If `line` is one row of a bracketed array, return { env, inner }. */
function parseRow(line) {
	const n = normalize(line).replace(/\s+$/, '');
	for (const [open, close, env] of FENCES) {
		if (n.startsWith(open) && n.endsWith(close) && n.length >= open.length + close.length) {
			return { env, inner: n.slice(open.length, n.length - close.length) };
		}
	}
	return null;
}

/** Split rows into columns at positions that are blank in every row. */
export function splitColumns(rows) {
	const width = Math.max(...rows.map((r) => r.length));
	const blank = (pos) => rows.every((r) => pos >= r.length || r[pos] === ' ');
	const ranges = [];
	let start = null;
	for (let pos = 0; pos <= width; pos++) {
		const isBlank = pos === width || blank(pos);
		if (!isBlank && start === null) start = pos;
		if (isBlank && start !== null) {
			ranges.push([start, pos]);
			start = null;
		}
	}
	// A function name followed by one space ("SIN A") is one entry: that space can line up
	// across rows (same-length names) and look like a column boundary, but never is one.
	const merged = [];
	for (const range of ranges) {
		const prev = merged[merged.length - 1];
		if (prev && range[0] - prev[1] === 1) {
			const splitsFunction = rows.some((r) => {
				const left = r.slice(prev[0], prev[1]).trim().split(' ').pop();
				return isFunctionName(left) && r.slice(range[0], range[1]).trim() !== '';
			});
			if (splitsFunction) {
				prev[1] = range[1];
				continue;
			}
		}
		merged.push([...range]);
	}
	return rows.map((r) => merged.map(([a, b]) => r.slice(a, b).trim()));
}

/**
 * Split a (possibly multi-line) Nemeth block into display-math chunks. Runs of two or
 * more array rows with the same fence become one matrix/determinant; every other line is
 * its own chunk, translated by `translate` (so callers keep their own fallback logic).
 * @param {string} text
 * @param {(nemeth: string) => string} translate - single-line / single-entry translator
 * @returns {string[]} LaTeX chunks (one `$$...$$` each); blank lines are dropped
 */
export function nemethDisplayChunks(text, translate) {
	const lines = text.split('\n');
	const chunks = [];
	for (let i = 0; i < lines.length; ) {
		const row = parseRow(lines[i]);
		if (row) {
			let j = i;
			const rows = [];
			while (j < lines.length) {
				const r = parseRow(lines[j]);
				if (!r || r.env !== row.env) break;
				rows.push(r.inner);
				j++;
			}
			if (rows.length >= 2) {
				const table = splitColumns(rows)
					.map((cells) => cells.map((c) => (c === '' ? '' : translate(c))).join(' & '))
					.join(' \\\\ ');
				chunks.push(`\\begin{${row.env}} ${table} \\end{${row.env}}`);
				i = j;
				continue;
			}
		}
		const latex = lines[i].trim() === '' ? '' : translate(lines[i]);
		if (latex.trim() !== '') chunks.push(latex);
		i++;
	}
	return chunks;
}
