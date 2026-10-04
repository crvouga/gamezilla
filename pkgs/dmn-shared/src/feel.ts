/**
 * The FEEL a decision table's cells are written in — the unary-tests subset
 * DMN tables use for input entries, and plain literals for output entries:
 *
 * - `-` matches anything;
 * - a literal matches itself: `"plus"`, `20`, `-1.5`, `true`, `false`, `null`
 *   (optionally written `= "plus"`);
 * - `< 20`, `<= 20`, `> 20`, `>= 20` compare against a number;
 * - `[0..19]`, `(0..20)`, `]0..20[`, `[0..20)` are number intervals, `[`/`]`
 *   closed at that end and `(`, `)` or an outward bracket open;
 * - `t1, t2` matches when any test does, `not(t1, t2)` when none does.
 *
 * Values are compared without coercion: `"20"` never matches `20`.
 */

export type FeelValue = string | number | boolean | null;

export type CompareOp = '<' | '<=' | '>' | '>=';

export type UnaryTest =
  | { readonly kind: 'any' }
  | { readonly kind: 'equal'; readonly value: FeelValue }
  | { readonly kind: 'compare'; readonly op: CompareOp; readonly value: number }
  | {
      readonly kind: 'interval';
      readonly low: number;
      readonly high: number;
      readonly lowClosed: boolean;
      readonly highClosed: boolean;
    }
  | { readonly kind: 'or'; readonly tests: readonly UnaryTest[] }
  | { readonly kind: 'not'; readonly tests: readonly UnaryTest[] };

export type FeelResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

type Scanner = { readonly text: string; pos: number };

class FeelSyntaxError extends Error {}

const NUMBER = /-?[0-9]+(\.[0-9]+)?/y;
const KEYWORD = /(true|false|null)(?![A-Za-z0-9_.])/y;

/** Parse an input entry (unary tests). */
export function parseUnaryTests(text: string): FeelResult<UnaryTest> {
  return attempt(text, (s) => {
    if (s.text.trim() === '-') {
      s.pos = s.text.length;
      return { kind: 'any' };
    }
    skipSpace(s);
    if (/^not\s*\(/.test(s.text.slice(s.pos))) {
      s.pos = s.text.indexOf('(', s.pos) + 1;
      const inner = readDisjunction(s);
      skipSpace(s);
      expectChar(s, ')');
      return { kind: 'not', tests: inner };
    }
    const tests = readDisjunction(s);
    return tests.length === 1 && tests[0] !== undefined
      ? tests[0]
      : { kind: 'or', tests };
  });
}

/** Parse an output entry or a single value: a literal. */
export function parseLiteral(text: string): FeelResult<FeelValue> {
  return attempt(text, (s) => {
    skipSpace(s);
    return readLiteral(s);
  });
}

/** Whether `value` passes `test`. */
export function matches(test: UnaryTest, value: FeelValue): boolean {
  switch (test.kind) {
    case 'any':
      return true;
    case 'equal':
      return test.value === value;
    case 'compare':
      return typeof value === 'number' && compare(value, test.op, test.value);
    case 'interval':
      return typeof value === 'number' && inInterval(test, value);
    case 'or':
      return test.tests.some((t) => matches(t, value));
    case 'not':
      return !test.tests.some((t) => matches(t, value));
    default:
      return false;
  }
}

/** Every number the test compares against, in order of appearance. */
export function numericEndpoints(test: UnaryTest): number[] {
  switch (test.kind) {
    case 'equal':
      return typeof test.value === 'number' ? [test.value] : [];
    case 'compare':
      return [test.value];
    case 'interval':
      return [test.low, test.high];
    case 'or':
    case 'not':
      return test.tests.flatMap(numericEndpoints);
    default:
      return [];
  }
}

/** The literals the test compares for equality. */
export function equalityLiterals(test: UnaryTest): FeelValue[] {
  switch (test.kind) {
    case 'equal':
      return [test.value];
    case 'or':
    case 'not':
      return test.tests.flatMap(equalityLiterals);
    default:
      return [];
  }
}

/** Whether the test compares numbers by order (`<`, intervals). */
export function usesOrder(test: UnaryTest): boolean {
  if (test.kind === 'compare' || test.kind === 'interval') return true;
  if (test.kind === 'or' || test.kind === 'not') {
    return test.tests.some(usesOrder);
  }
  return false;
}

/** A value as FEEL writes it: strings quoted, everything else bare. */
export function renderFeelValue(value: FeelValue): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

function attempt<T>(text: string, read: (s: Scanner) => T): FeelResult<T> {
  const s: Scanner = { text, pos: 0 };
  try {
    const value = read(s);
    skipSpace(s);
    if (s.pos < s.text.length) {
      throw new FeelSyntaxError(`unexpected "${s.text.slice(s.pos)}"`);
    }
    return { ok: true, value };
  } catch (cause) {
    if (!(cause instanceof FeelSyntaxError)) throw cause;
    return {
      ok: false,
      error: `FEEL ${JSON.stringify(text)}: ${cause.message}`,
    };
  }
}

function compare(a: number, op: CompareOp, b: number): boolean {
  if (op === '<') return a < b;
  if (op === '<=') return a <= b;
  if (op === '>') return a > b;
  return a >= b;
}

function inInterval(
  test: Extract<UnaryTest, { kind: 'interval' }>,
  value: number
): boolean {
  const aboveLow = test.lowClosed ? value >= test.low : value > test.low;
  const belowHigh = test.highClosed ? value <= test.high : value < test.high;
  return aboveLow && belowHigh;
}

function skipSpace(s: Scanner): void {
  while (s.pos < s.text.length && /\s/.test(s.text[s.pos] ?? '')) s.pos += 1;
}

function expectChar(s: Scanner, ch: string): void {
  if (s.text[s.pos] !== ch) {
    throw new FeelSyntaxError(`expected "${ch}" at ${String(s.pos + 1)}`);
  }
  s.pos += 1;
}

function readDisjunction(s: Scanner): UnaryTest[] {
  const tests = [readSimple(s)];
  for (;;) {
    skipSpace(s);
    if (s.text[s.pos] !== ',') return tests;
    s.pos += 1;
    tests.push(readSimple(s));
  }
}

function readSimple(s: Scanner): UnaryTest {
  skipSpace(s);
  const ch = s.text[s.pos];
  if (ch === '[' || ch === '(' || ch === ']') return readInterval(s);
  if (ch === '<' || ch === '>') {
    const op: CompareOp =
      s.text[s.pos + 1] === '=' ? (`${ch}=` as CompareOp) : ch;
    s.pos += op.length;
    skipSpace(s);
    return { kind: 'compare', op, value: readNumber(s) };
  }
  if (ch === '=') {
    s.pos += 1;
    skipSpace(s);
  }
  return { kind: 'equal', value: readLiteral(s) };
}

function readInterval(s: Scanner): UnaryTest {
  const lowClosed = s.text[s.pos] === '[';
  s.pos += 1;
  skipSpace(s);
  const low = readNumber(s);
  skipSpace(s);
  if (!s.text.startsWith('..', s.pos)) {
    throw new FeelSyntaxError(`expected ".." at ${String(s.pos + 1)}`);
  }
  s.pos += 2;
  skipSpace(s);
  const high = readNumber(s);
  skipSpace(s);
  const end = s.text[s.pos];
  if (end !== ']' && end !== ')' && end !== '[') {
    throw new FeelSyntaxError(`expected the end of an interval`);
  }
  s.pos += 1;
  if (low > high) {
    throw new FeelSyntaxError(
      `interval ${String(low)}..${String(high)} is empty`
    );
  }
  return { kind: 'interval', low, high, lowClosed, highClosed: end === ']' };
}

function readNumber(s: Scanner): number {
  NUMBER.lastIndex = s.pos;
  const match = NUMBER.exec(s.text);
  if (match === null) {
    throw new FeelSyntaxError(`expected a number at ${String(s.pos + 1)}`);
  }
  s.pos += match[0].length;
  return Number(match[0]);
}

function readLiteral(s: Scanner): FeelValue {
  const ch = s.text[s.pos];
  if (ch === '"') return readString(s);
  KEYWORD.lastIndex = s.pos;
  const keyword = KEYWORD.exec(s.text);
  if (keyword !== null) {
    s.pos += keyword[0].length;
    if (keyword[0] === 'null') return null;
    return keyword[0] === 'true';
  }
  if (ch === '-' || (ch !== undefined && ch >= '0' && ch <= '9')) {
    return readNumber(s);
  }
  throw new FeelSyntaxError(
    ch === undefined
      ? 'expected a value'
      : `expected a value at ${String(s.pos + 1)}`
  );
}

const ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  '\\': '\\',
  n: '\n',
  t: '\t',
  r: '\r',
};

function readString(s: Scanner): string {
  let out = '';
  for (let i = s.pos + 1; i < s.text.length; i += 1) {
    const ch = s.text[i] ?? '';
    if (ch === '"') {
      s.pos = i + 1;
      return out;
    }
    if (ch === '\\') {
      const escaped = ESCAPES[s.text[i + 1] ?? ''];
      if (escaped === undefined) {
        throw new FeelSyntaxError(`unknown escape at ${String(i + 1)}`);
      }
      out += escaped;
      i += 1;
    } else out += ch;
  }
  throw new FeelSyntaxError('the string is not closed');
}
