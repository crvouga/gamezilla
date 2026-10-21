/**
 * Tokens for the HCL subset OpenTofu configuration uses: identifiers,
 * numbers, quoted and heredoc templates, punctuation and significant
 * newlines. Newlines inside `(` and `[` are not significant (HCL rule), so
 * the parser never sees them there.
 */

export type TemplatePart =
  | string
  | { readonly source: string; readonly line: number };

export type Token =
  | { readonly type: 'ident'; readonly text: string; readonly line: number }
  | { readonly type: 'number'; readonly value: number; readonly line: number }
  | {
      readonly type: 'template';
      readonly parts: readonly TemplatePart[];
      readonly line: number;
    }
  | { readonly type: 'punct'; readonly text: string; readonly line: number }
  | { readonly type: 'newline'; readonly line: number }
  | { readonly type: 'eof'; readonly line: number };

export class HclSyntaxError extends Error {
  readonly line: number;

  constructor(message: string, line: number) {
    super(`line ${line}: ${message}`);
    this.name = 'HclSyntaxError';
    this.line = line;
  }
}

type State = {
  readonly src: string;
  pos: number;
  line: number;
  readonly tokens: Token[];
  readonly brackets: string[];
};

const PUNCT3 = ['...'];
const PUNCT2 = ['==', '!=', '<=', '>=', '&&', '||', '=>'];
const PUNCT1 = '{}[]():,.?=<>+-*/%!';
const CLOSER: Readonly<Record<string, string>> = {
  ')': '(',
  ']': '[',
  '}': '{',
};

const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isIdentStart = (c: string): boolean => /[A-Za-z_]/.test(c);
const isIdentPart = (c: string): boolean => /[A-Za-z0-9_-]/.test(c);

function peek(s: State, offset = 0): string {
  return s.src.charAt(s.pos + offset);
}

function newlineSignificant(s: State): boolean {
  const top = s.brackets[s.brackets.length - 1];
  return top === undefined || top === '{';
}

function pushNewline(s: State): void {
  if (!newlineSignificant(s)) return;
  const last = s.tokens[s.tokens.length - 1];
  if (last === undefined || last.type === 'newline') return;
  s.tokens.push({ type: 'newline', line: s.line });
}

function skipTrivia(s: State): boolean {
  const c = peek(s);
  if (c === ' ' || c === '\t' || c === '\r') {
    s.pos += 1;
    return true;
  }
  if (c === '\n') {
    pushNewline(s);
    s.pos += 1;
    s.line += 1;
    return true;
  }
  if (c === '#' || (c === '/' && peek(s, 1) === '/')) {
    while (s.pos < s.src.length && peek(s) !== '\n') s.pos += 1;
    return true;
  }
  if (c === '/' && peek(s, 1) === '*') {
    const end = s.src.indexOf('*/', s.pos + 2);
    const stop = end === -1 ? s.src.length : end + 2;
    for (let i = s.pos; i < stop; i += 1) {
      if (s.src.charAt(i) === '\n') s.line += 1;
    }
    s.pos = stop;
    return true;
  }
  return false;
}

/** Index just past the `}` closing an interpolation opened before `start`. */
function interpolationEnd(src: string, start: number): number {
  let depth = 1;
  let i = start;
  while (i < src.length) {
    const c = src.charAt(i);
    if (c === '"') {
      i = quotedEnd(src, i + 1);
      continue;
    }
    if (c === '{') depth += 1;
    if (c === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  return src.length;
}

/** Index just past the `"` closing a quoted template that starts at `start`. */
function quotedEnd(src: string, start: number): number {
  let i = start;
  while (i < src.length) {
    const c = src.charAt(i);
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '"') return i + 1;
    if ((c === '$' || c === '%') && src.charAt(i + 1) === '{') {
      i = interpolationEnd(src, i + 2);
      continue;
    }
    i += 1;
  }
  return src.length;
}

const ESCAPES: Readonly<Record<string, string>> = {
  n: '\n',
  t: '\t',
  r: '\r',
  '"': '"',
  '\\': '\\',
};

function unescape(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw.charAt(i);
    if (c !== '\\') {
      out += c;
      continue;
    }
    const next = raw.charAt(i + 1);
    if (next === 'u' || next === 'U') {
      const width = next === 'u' ? 4 : 8;
      const code = Number.parseInt(raw.slice(i + 2, i + 2 + width), 16);
      out += Number.isNaN(code) ? '' : String.fromCodePoint(code);
      i += 1 + width;
      continue;
    }
    out += ESCAPES[next] ?? next;
    i += 1;
  }
  return out;
}

/** Split template body text into literal runs and `${ … }` sources. */
function templateParts(body: string, firstLine: number): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let literal = '';
  let line = firstLine;
  let i = 0;
  while (i < body.length) {
    const c = body.charAt(i);
    const two = body.slice(i, i + 3);
    if (two === '$${' || two === '%%{') {
      literal += `${c}{`;
      i += 3;
      continue;
    }
    if (c === '$' && body.charAt(i + 1) === '{') {
      const end = interpolationEnd(body, i + 2);
      if (literal !== '') parts.push(unescape(literal));
      literal = '';
      parts.push({ source: body.slice(i + 2, end - 1), line });
      for (const ch of body.slice(i, end)) if (ch === '\n') line += 1;
      i = end;
      continue;
    }
    if (c === '\n') line += 1;
    literal += c;
    i += 1;
  }
  if (literal !== '') parts.push(unescape(literal));
  return parts;
}

function lexQuoted(s: State): void {
  const startLine = s.line;
  const end = quotedEnd(s.src, s.pos + 1);
  const body = s.src.slice(s.pos + 1, Math.max(s.pos + 1, end - 1));
  for (const ch of s.src.slice(s.pos, end)) if (ch === '\n') s.line += 1;
  s.pos = end;
  s.tokens.push({
    type: 'template',
    parts: templateParts(body, startLine),
    line: startLine,
  });
}

function heredocOpener(s: State): { marker: string; indent: boolean } | null {
  const m = /^<<(-?)([A-Za-z_][A-Za-z0-9_]*)\r?\n/.exec(s.src.slice(s.pos));
  if (m === null) return null;
  return { marker: m[2] as string, indent: m[1] === '-' };
}

function lexHeredoc(s: State, open: { marker: string; indent: boolean }): void {
  const startLine = s.line;
  const lines = s.src.slice(s.pos).split('\n');
  const bodyLines: string[] = [];
  let consumed = 1;
  for (let i = 1; i < lines.length; i += 1) {
    consumed += 1;
    const raw = lines[i] as string;
    if (raw.trim() === open.marker) break;
    bodyLines.push(raw.replace(/\r$/, ''));
  }
  s.pos += lines.slice(0, consumed).join('\n').length;
  s.line += consumed - 1;
  const trim = open.indent
    ? Math.min(
        ...bodyLines
          .filter((l) => l.trim() !== '')
          .map((l) => (l.match(/^\s*/) as RegExpMatchArray)[0].length),
        Number.POSITIVE_INFINITY
      )
    : 0;
  const text = bodyLines
    .map((l) => (Number.isFinite(trim) ? l.slice(trim) : l))
    .join('\n');
  s.tokens.push({
    type: 'template',
    parts: templateParts(text === '' ? '' : `${text}\n`, startLine + 1),
    line: startLine,
  });
}

function lexNumber(s: State): void {
  const m = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(s.src.slice(s.pos));
  const text = (m as RegExpExecArray)[0];
  s.pos += text.length;
  s.tokens.push({ type: 'number', value: Number(text), line: s.line });
}

function lexIdent(s: State): void {
  let end = s.pos;
  while (end < s.src.length && isIdentPart(s.src.charAt(end))) end += 1;
  s.tokens.push({
    type: 'ident',
    text: s.src.slice(s.pos, end),
    line: s.line,
  });
  s.pos = end;
}

function lexPunct(s: State): void {
  const three = s.src.slice(s.pos, s.pos + 3);
  const two = s.src.slice(s.pos, s.pos + 2);
  const one = peek(s);
  let text = '';
  if (PUNCT3.includes(three)) text = three;
  else if (PUNCT2.includes(two)) text = two;
  else if (PUNCT1.includes(one)) text = one;
  else
    throw new HclSyntaxError(
      `unexpected character ${JSON.stringify(one)}`,
      s.line
    );
  s.pos += text.length;
  if (text === '(' || text === '[' || text === '{') s.brackets.push(text);
  const opener = CLOSER[text];
  if (opener !== undefined && s.brackets[s.brackets.length - 1] === opener) {
    s.brackets.pop();
  }
  s.tokens.push({ type: 'punct', text, line: s.line });
}

function lexOne(s: State): void {
  const c = peek(s);
  if (c === '"') return lexQuoted(s);
  if (isDigit(c)) return lexNumber(s);
  if (isIdentStart(c)) return lexIdent(s);
  if (c === '<' && peek(s, 1) === '<') {
    const open = heredocOpener(s);
    if (open !== null) return lexHeredoc(s, open);
  }
  lexPunct(s);
}

export function lex(source: string, firstLine = 1): Token[] {
  const s: State = {
    src: source,
    pos: 0,
    line: firstLine,
    tokens: [],
    brackets: [],
  };
  while (s.pos < s.src.length) {
    if (!skipTrivia(s)) lexOne(s);
  }
  s.tokens.push({ type: 'eof', line: s.line });
  return s.tokens;
}
