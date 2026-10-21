/**
 * Recursive-descent parser for OpenTofu `.tf` files: blocks, attributes and
 * the full expression language the configuration uses (templates,
 * conditionals, `for`, splat, calls). Pure: text in, tree out.
 */

import type { Accessor, Block, Body, Expr } from './hcl-ast';
import type { Token } from './hcl-lex';
import { HclSyntaxError, lex } from './hcl-lex';

const BINARY_LEVELS: readonly (readonly string[])[] = [
  ['||'],
  ['&&'],
  ['==', '!='],
  ['<', '>', '<=', '>='],
  ['+', '-'],
  ['*', '/', '%'],
];

class Parser {
  private pos = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  peek(offset = 0): Token {
    const last = this.tokens[this.tokens.length - 1] as Token;
    return this.tokens[this.pos + offset] ?? last;
  }

  next(): Token {
    const token = this.peek();
    if (token.type !== 'eof') this.pos += 1;
    return token;
  }

  atPunct(text: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.type === 'punct' && t.text === text;
  }

  atIdent(text?: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.type === 'ident' && (text === undefined || t.text === text);
  }

  eatPunct(text: string): boolean {
    if (!this.atPunct(text)) return false;
    this.pos += 1;
    return true;
  }

  expectPunct(text: string): void {
    if (this.eatPunct(text)) return;
    this.fail(`expected "${text}"`);
  }

  expectIdent(): string {
    const t = this.next();
    if (t.type === 'ident') return t.text;
    return this.failAt(t, 'expected an identifier');
  }

  skipNewlines(): void {
    while (this.peek().type === 'newline') this.pos += 1;
  }

  fail(message: string): never {
    return this.failAt(this.peek(), message);
  }

  failAt(token: Token, message: string): never {
    throw new HclSyntaxError(message, token.line);
  }

  // ---- bodies -------------------------------------------------------------

  parseBody(closing: boolean): Body {
    const attributes = new Map<string, Expr>();
    const blocks: Block[] = [];
    for (;;) {
      this.skipNewlines();
      if (closing ? this.atPunct('}') : this.peek().type === 'eof') break;
      if (this.peek().type === 'eof') this.fail('unterminated block');
      const first = this.next();
      const name =
        first.type === 'ident'
          ? first.text
          : this.failAt(first, 'expected an argument or block');
      if (this.eatPunct('=')) {
        attributes.set(name, this.parseExpr());
      } else {
        blocks.push(this.parseBlockRest(name, first.line));
      }
      this.endOfItem(closing);
    }
    return { attributes, blocks };
  }

  endOfItem(closing: boolean): void {
    if (this.peek().type === 'newline') return;
    if (this.peek().type === 'eof') return;
    if (closing && this.atPunct('}')) return;
    this.fail('expected a newline after the argument');
  }

  parseBlockRest(type: string, line: number): Block {
    const labels: string[] = [];
    for (;;) {
      const t = this.peek();
      if (t.type === 'ident') {
        labels.push(t.text);
        this.next();
      } else if (t.type === 'template') {
        labels.push(t.parts.filter((p) => typeof p === 'string').join(''));
        this.next();
      } else break;
    }
    this.expectPunct('{');
    const body = this.parseBody(true);
    this.expectPunct('}');
    return { type, labels, body, line };
  }

  // ---- expressions --------------------------------------------------------

  parseExpr(): Expr {
    const test = this.parseBinary(0);
    if (!this.atPunct('?')) return test;
    this.next();
    const then = this.parseExpr();
    this.expectPunct(':');
    const otherwise = this.parseExpr();
    return { kind: 'conditional', test, then, otherwise };
  }

  parseBinary(level: number): Expr {
    const ops = BINARY_LEVELS[level];
    if (ops === undefined) return this.parseUnary();
    let left = this.parseBinary(level + 1);
    for (;;) {
      const t = this.peek();
      if (t.type !== 'punct' || !ops.includes(t.text)) return left;
      this.next();
      left = {
        kind: 'binary',
        op: t.text,
        left,
        right: this.parseBinary(level + 1),
      };
    }
  }

  parseUnary(): Expr {
    if (this.atPunct('!') || this.atPunct('-')) {
      const op = (this.next() as { text: string }).text as '!' | '-';
      return { kind: 'unary', op, operand: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  parsePostfix(): Expr {
    let expr = this.parsePrimary();
    for (;;) {
      if (this.atPunct('.')) {
        expr = this.parseDot(expr);
      } else if (this.atPunct('[')) {
        expr = this.parseBracket(expr);
      } else return expr;
    }
  }

  parseDot(target: Expr): Expr {
    this.next();
    if (this.eatPunct('*')) {
      return { kind: 'splat', target, path: this.parseSplatPath() };
    }
    const t = this.next();
    if (t.type === 'ident') return { kind: 'attr', target, name: t.text };
    if (t.type === 'number') {
      return {
        kind: 'index',
        target,
        key: { kind: 'literal', value: t.value },
      };
    }
    return this.failAt(t, 'expected an attribute name after "."');
  }

  parseBracket(target: Expr): Expr {
    this.next();
    if (this.atPunct('*') && this.atPunct(']', 1)) {
      this.next();
      this.next();
      return { kind: 'splat', target, path: this.parseSplatPath() };
    }
    const key = this.parseExpr();
    this.expectPunct(']');
    return { kind: 'index', target, key };
  }

  parseSplatPath(): Accessor[] {
    const path: Accessor[] = [];
    for (;;) {
      if (this.atPunct('.') && this.atIdent(undefined, 1)) {
        this.next();
        path.push({ kind: 'attr', name: this.expectIdent() });
      } else if (this.atPunct('[') && !this.atPunct('*', 1)) {
        this.next();
        const key = this.parseExpr();
        this.expectPunct(']');
        path.push({ kind: 'index', key });
      } else return path;
    }
  }

  parsePrimary(): Expr {
    const t = this.next();
    switch (t.type) {
      case 'number':
        return { kind: 'literal', value: t.value };
      case 'template':
        return this.templateExpr(t.parts);
      case 'ident':
        return this.parseIdentExpr(t.text);
      case 'punct':
        return this.parsePunctPrimary(t);
      default:
        return this.failAt(t, 'expected an expression');
    }
  }

  templateExpr(
    parts: readonly (string | { source: string; line: number })[]
  ): Expr {
    const out: (string | Expr)[] = [];
    for (const part of parts) {
      if (typeof part === 'string') out.push(part);
      else out.push(parseExpression(part.source, part.line));
    }
    return { kind: 'template', parts: out };
  }

  parseIdentExpr(name: string): Expr {
    if (name === 'true') return { kind: 'literal', value: true };
    if (name === 'false') return { kind: 'literal', value: false };
    if (name === 'null') return { kind: 'literal', value: null };
    if (!this.atPunct('(')) return { kind: 'name', name };
    this.next();
    const args: Expr[] = [];
    this.skipNewlines();
    while (!this.atPunct(')')) {
      args.push(this.parseExpr());
      this.eatPunct('...');
      this.skipNewlines();
      if (!this.eatPunct(',')) break;
      this.skipNewlines();
    }
    this.expectPunct(')');
    return { kind: 'call', name, args };
  }

  parsePunctPrimary(t: { text: string; line: number }): Expr {
    if (t.text === '(') {
      const inner = this.parseExpr();
      this.expectPunct(')');
      return inner;
    }
    if (t.text === '[') return this.parseTuple();
    if (t.text === '{') return this.parseObject();
    return this.failAt(
      { type: 'punct', text: t.text, line: t.line },
      `unexpected "${t.text}"`
    );
  }

  parseTuple(): Expr {
    this.skipNewlines();
    if (this.atIdent('for')) return this.parseFor(false, ']');
    const items: Expr[] = [];
    while (!this.atPunct(']')) {
      items.push(this.parseExpr());
      this.skipNewlines();
      if (!this.eatPunct(',')) break;
      this.skipNewlines();
    }
    this.expectPunct(']');
    return { kind: 'tuple', items };
  }

  parseObject(): Expr {
    this.skipNewlines();
    if (this.atIdent('for')) return this.parseFor(true, '}');
    const entries: { key: Expr; value: Expr }[] = [];
    while (!this.atPunct('}')) {
      const key = this.parseObjectKey();
      if (!this.eatPunct('=') && !this.eatPunct(':')) {
        this.fail('expected "=" or ":" after an object key');
      }
      entries.push({ key, value: this.parseExpr() });
      this.skipNewlines();
      this.eatPunct(',');
      this.skipNewlines();
    }
    this.expectPunct('}');
    return { kind: 'object', entries };
  }

  parseObjectKey(): Expr {
    const t = this.peek();
    const after = this.peek(1);
    const bare =
      t.type === 'ident' &&
      after.type === 'punct' &&
      (after.text === '=' || after.text === ':');
    if (bare) {
      this.next();
      return { kind: 'literal', value: (t as { text: string }).text };
    }
    return this.parsePostfix();
  }

  parseFor(asObject: boolean, closing: string): Expr {
    this.next();
    let keyVar: string | null = null;
    let valueVar = this.expectIdent();
    if (this.eatPunct(',')) {
      keyVar = valueVar;
      valueVar = this.expectIdent();
    }
    if (!this.atIdent('in')) this.fail('expected "in"');
    this.next();
    const collection = this.parseExpr();
    this.expectPunct(':');
    this.skipNewlines();
    let keyExpr: Expr | null = null;
    let valueExpr = this.parseExpr();
    if (asObject) {
      this.expectPunct('=>');
      keyExpr = valueExpr;
      valueExpr = this.parseExpr();
      this.eatPunct('...');
    }
    this.skipNewlines();
    let condition: Expr | null = null;
    if (this.atIdent('if')) {
      this.next();
      condition = this.parseExpr();
      this.skipNewlines();
    }
    this.expectPunct(closing);
    return {
      kind: 'for',
      keyVar,
      valueVar,
      collection,
      keyExpr,
      valueExpr,
      condition,
      asObject,
    };
  }
}

/** One expression from source text (an interpolation body or a snippet). */
export function parseExpression(source: string, firstLine = 1): Expr {
  const parser = new Parser(lex(source, firstLine));
  parser.skipNewlines();
  const expr = parser.parseExpr();
  parser.skipNewlines();
  if (parser.peek().type !== 'eof') parser.fail('unexpected trailing input');
  return expr;
}

/** A whole `.tf` file. */
export function parseConfig(source: string): Body {
  return new Parser(lex(source)).parseBody(false);
}
