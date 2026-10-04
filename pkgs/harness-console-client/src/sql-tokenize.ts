import type { CodeToken, CodeTokenKind } from '@pkgs/ui-shared/code-editor-types';

import type { SqlDialect } from './sql-dialect';
import { sqlKeywordSet } from './sql-dialect';

export type SqlStatementKind = 'rows' | 'changes';

const ROWS_HEAD =
  /^(select|with|values|pragma|explain|show|table|returning)\b/i;

/**
 * Lex SQL into highlight tokens. Covers `--` / block comments, quoted
 * strings/identifiers, numbers, params (`?` / `$1`), operators, keywords.
 */
export function tokenizeSql(
  src: string,
  dialect: SqlDialect
): readonly CodeToken[] {
  const keywords = sqlKeywordSet(dialect);
  const out: CodeToken[] = [];
  let i = 0;
  while (i < src.length) {
    const next = nextToken(src, i, keywords);
    if (next === null) {
      i += 1;
      continue;
    }
    out.push(next.token);
    i = next.end;
  }
  return out;
}

function nextToken(
  src: string,
  i: number,
  keywords: ReadonlySet<string>
): { readonly token: CodeToken; readonly end: number } | null {
  const ch = src[i]!;
  if (/\s/.test(ch)) return null;
  const comment = tryCommentToken(src, i);
  if (comment != null) return comment;
  const quoted = tryQuotedToken(src, i);
  if (quoted != null) return quoted;
  if (isDigit(ch) || (ch === '.' && isDigit(src[i + 1] ?? ''))) {
    const end = consumeNumber(src, i);
    return { token: { kind: 'number', start: i, end }, end };
  }
  if (ch === '?' || (ch === '$' && isDigit(src[i + 1] ?? ''))) {
    const end = consumeParam(src, i);
    return { token: { kind: 'param', start: i, end }, end };
  }
  if (isIdentStart(ch)) {
    const end = consumeIdent(src, i);
    const word = src.slice(i, end).toLowerCase();
    const kind: CodeTokenKind = keywords.has(word) ? 'keyword' : 'identifier';
    return { token: { kind, start: i, end }, end };
  }
  if (isOperatorChar(ch)) {
    const end = consumeOperator(src, i);
    return { token: { kind: 'operator', start: i, end }, end };
  }
  return { token: { kind: 'punctuation', start: i, end: i + 1 }, end: i + 1 };
}

function tryCommentToken(
  src: string,
  i: number
): { readonly token: CodeToken; readonly end: number } | null {
  const ch = src[i]!;
  if (ch === '-' && src[i + 1] === '-') {
    const end = consumeLineComment(src, i);
    return { token: { kind: 'comment', start: i, end }, end };
  }
  if (ch === '/' && src[i + 1] === '*') {
    const end = consumeBlockComment(src, i);
    return { token: { kind: 'comment', start: i, end }, end };
  }
  return null;
}

function tryQuotedToken(
  src: string,
  i: number
): { readonly token: CodeToken; readonly end: number } | null {
  const ch = src[i]!;
  if (ch !== "'" && ch !== '"' && ch !== '`') return null;
  const end = consumeQuoted(src, i, ch);
  const kind: CodeTokenKind = ch === "'" ? 'string' : 'identifier';
  return { token: { kind, start: i, end }, end };
}

/** Split on `;` outside strings/comments. Empty/whitespace-only parts dropped. */
export function splitSqlStatements(src: string): readonly string[] {
  const parts: string[] = [];
  let start = 0;
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === '-' && src[i + 1] === '-') {
      i = consumeLineComment(src, i);
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i = consumeBlockComment(src, i);
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = consumeQuoted(src, i, ch);
      continue;
    }
    if (ch === ';') {
      const part = src.slice(start, i).trim();
      if (part.length > 0) parts.push(part);
      i += 1;
      start = i;
      continue;
    }
    i += 1;
  }
  const tail = src.slice(start).trim();
  if (tail.length > 0) parts.push(tail);
  return parts;
}

export function classifySqlStatement(stmt: string): SqlStatementKind {
  const stripped = stripLeadingTrivia(stmt).trimStart();
  return ROWS_HEAD.test(stripped) ? 'rows' : 'changes';
}

function stripLeadingTrivia(src: string): string {
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '-' && src[i + 1] === '-') {
      i = consumeLineComment(src, i);
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i = consumeBlockComment(src, i);
      continue;
    }
    break;
  }
  return src.slice(i);
}

function consumeLineComment(src: string, i: number): number {
  let j = i + 2;
  while (j < src.length && src[j] !== '\n') j += 1;
  return j;
}

function consumeBlockComment(src: string, i: number): number {
  let j = i + 2;
  while (j < src.length) {
    if (src[j] === '*' && src[j + 1] === '/') return j + 2;
    j += 1;
  }
  return j;
}

function consumeQuoted(src: string, i: number, quote: string): number {
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === quote) {
      if (src[j + 1] === quote) {
        j += 2;
        continue;
      }
      return j + 1;
    }
    j += 1;
  }
  return j;
}

function consumeNumber(src: string, i: number): number {
  let j = i;
  while (j < src.length && (isDigit(src[j]!) || src[j] === '.')) j += 1;
  return j;
}

function consumeParam(src: string, i: number): number {
  if (src[i] === '?') return i + 1;
  let j = i + 1;
  while (j < src.length && isDigit(src[j]!)) j += 1;
  return j;
}

function consumeIdent(src: string, i: number): number {
  let j = i + 1;
  while (j < src.length && isIdentCont(src[j]!)) j += 1;
  return j;
}

function consumeOperator(src: string, i: number): number {
  const two = src.slice(i, i + 2);
  if (
    two === '<=' ||
    two === '>=' ||
    two === '<>' ||
    two === '!=' ||
    two === '||' ||
    two === '->' ||
    two === '=>'
  ) {
    return i + 2;
  }
  return i + 1;
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isIdentCont(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch) || ch === '$';
}

function isOperatorChar(ch: string): boolean {
  return '=<>!+-*/%|&^~'.includes(ch);
}
