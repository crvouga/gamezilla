/**
 * A small, strict XML reader — enough for DMN files and nothing more: the XML
 * declaration, elements, attributes, text, CDATA, comments, the five named
 * entities and numeric character references. A DOCTYPE (and with it every
 * entity definition) is refused, as are processing instructions, so reading a
 * spec can never expand or fetch anything.
 *
 * Namespaces are not resolved: an element keeps its prefix and exposes its
 * `localName`, which is what DMN readers match on. Every error names the
 * line and column it was found at.
 */

export type XmlElement = {
  readonly kind: 'element';
  /** The name as written (`dmn:decision`). */
  readonly name: string;
  readonly prefix: string | null;
  /** The name without its prefix (`decision`). */
  readonly localName: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly children: readonly XmlNode[];
  /** Offset of the element's `<` in the source, for {@link locate}. */
  readonly offset: number;
};

export type XmlText = { readonly kind: 'text'; readonly value: string };

export type XmlNode = XmlElement | XmlText;

export type XmlLocation = { readonly line: number; readonly column: number };

export class XmlError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, at: XmlLocation) {
    super(`${String(at.line)}:${String(at.column)}: ${message}`);
    this.name = 'XmlError';
    this.line = at.line;
    this.column = at.column;
  }
}

type Reader = { readonly src: string; pos: number };

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
};

const NAME = /[A-Za-z_:\u00C0-\uFFFF][-A-Za-z0-9_:.\u00B7\u00C0-\uFFFF]*/y;
const WHITESPACE = /[ \t\n]/;

/** Line and column (both 1-based) of `offset` in `source`. */
export function locate(source: string, offset: number): XmlLocation {
  const before = source.replace(/\r\n?/g, '\n').slice(0, offset);
  const lastBreak = before.lastIndexOf('\n');
  return {
    line: before.split('\n').length,
    column: offset - lastBreak,
  };
}

/** The document's root element. Throws {@link XmlError}. */
export function parseXml(source: string): XmlElement {
  const src = source.replace(/\r\n?/g, '\n');
  const r: Reader = { src, pos: src.startsWith('\uFEFF') ? 1 : 0 };
  const forbidden = firstForbiddenChar(src);
  if (forbidden >= 0) fail(r, 'a character XML does not allow', forbidden);
  readDeclaration(r);
  readMisc(r);
  if (!src.startsWith('<', r.pos)) fail(r, 'expected the root element');
  const root = readElement(r);
  readMisc(r);
  if (r.pos < src.length) fail(r, 'content after the root element');
  return root;
}

/** Text safe inside an element or a quoted attribute value. */
export function escapeXml(text: string): string {
  return text.replace(/[&<>"'\t\n\r]/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&apos;';
      default:
        return `&#${String(ch.charCodeAt(0))};`;
    }
  });
}

/** Direct child elements, optionally only those with this local name. */
export function childElements(
  element: XmlElement,
  localName?: string
): readonly XmlElement[] {
  return element.children.filter(
    (child): child is XmlElement =>
      child.kind === 'element' &&
      (localName === undefined || child.localName === localName)
  );
}

/** The element's own text (its direct text children, joined). */
export function textOf(element: XmlElement): string {
  return element.children
    .map((child) => (child.kind === 'text' ? child.value : ''))
    .join('');
}

function fail(r: Reader, message: string, at: number = r.pos): never {
  throw new XmlError(message, locate(r.src, at));
}

function skipWhitespace(r: Reader): boolean {
  const start = r.pos;
  while (r.pos < r.src.length && WHITESPACE.test(r.src[r.pos] ?? '')) {
    r.pos += 1;
  }
  return r.pos > start;
}

function expect(r: Reader, token: string): void {
  if (!r.src.startsWith(token, r.pos)) fail(r, `expected "${token}"`);
  r.pos += token.length;
}

function readName(r: Reader): string {
  NAME.lastIndex = r.pos;
  const match = NAME.exec(r.src);
  if (match === null) fail(r, 'expected a name');
  r.pos += match[0].length;
  return match[0];
}

function readDeclaration(r: Reader): void {
  if (!/^<\?xml[ \t\n?]/.test(r.src.slice(r.pos, r.pos + 6))) return;
  const end = r.src.indexOf('?>', r.pos);
  if (end < 0) fail(r, 'the XML declaration is not closed');
  if (!/\bversion\s*=/.test(r.src.slice(r.pos, end))) {
    fail(r, 'the XML declaration has no version');
  }
  r.pos = end + 2;
}

/** Whitespace and comments between the declaration, the root and the end. */
function readMisc(r: Reader): void {
  for (;;) {
    skipWhitespace(r);
    if (r.src.startsWith('<!--', r.pos)) readComment(r);
    else if (r.src.startsWith('<!DOCTYPE', r.pos)) {
      fail(r, 'a DOCTYPE is not allowed (no DTDs or entity definitions)');
    } else if (r.src.startsWith('<?', r.pos)) {
      fail(r, 'processing instructions are not supported');
    } else return;
  }
}

function readComment(r: Reader): void {
  const start = r.pos;
  const end = r.src.indexOf('-->', r.pos + 4);
  if (end < 0) fail(r, 'the comment is not closed', start);
  if (r.src.slice(start + 4, end).includes('--')) {
    fail(r, '"--" is not allowed inside a comment', start);
  }
  r.pos = end + 3;
}

function readElement(r: Reader): XmlElement {
  const offset = r.pos;
  expect(r, '<');
  const name = readName(r);
  const attributes = readAttributes(r);
  const colon = name.indexOf(':');
  const shape = {
    kind: 'element' as const,
    name,
    prefix: colon < 0 ? null : name.slice(0, colon),
    localName: colon < 0 ? name : name.slice(colon + 1),
    attributes,
    offset,
  };
  if (r.src.startsWith('/>', r.pos)) {
    r.pos += 2;
    return { ...shape, children: [] };
  }
  expect(r, '>');
  return { ...shape, children: readContent(r, name) };
}

function readAttributes(r: Reader): Map<string, string> {
  const attributes = new Map<string, string>();
  for (;;) {
    const spaced = skipWhitespace(r);
    if (r.src.startsWith('/>', r.pos) || r.src.startsWith('>', r.pos)) {
      return attributes;
    }
    if (!spaced) fail(r, 'expected whitespace before an attribute');
    const at = r.pos;
    const name = readName(r);
    skipWhitespace(r);
    expect(r, '=');
    skipWhitespace(r);
    const quote = r.src[r.pos];
    if (quote !== '"' && quote !== "'") fail(r, 'expected a quoted value');
    const end = r.src.indexOf(quote, r.pos + 1);
    if (end < 0) fail(r, 'the attribute value is not closed');
    const raw = r.src.slice(r.pos + 1, end);
    const lt = raw.indexOf('<');
    if (lt >= 0) fail(r, '"<" is not allowed in an attribute', r.pos + 1 + lt);
    if (attributes.has(name)) fail(r, `attribute ${name} is repeated`, at);
    attributes.set(name, decode(r, { raw, base: r.pos + 1, attribute: true }));
    r.pos = end + 1;
  }
}

function readContent(r: Reader, name: string): XmlNode[] {
  const children: XmlNode[] = [];
  let text = '';
  const flush = () => {
    if (text !== '') children.push({ kind: 'text', value: text });
    text = '';
  };
  for (;;) {
    if (r.pos >= r.src.length) fail(r, `element <${name}> is not closed`);
    if (r.src.startsWith('</', r.pos)) {
      flush();
      readEndTag(r, name);
      return children;
    }
    if (r.src.startsWith('<', r.pos)) {
      const markup = readMarkup(r);
      if (markup === null) {
        flush();
        children.push(readElement(r));
      } else text += markup;
    } else text += readText(r);
  }
}

function readEndTag(r: Reader, name: string): void {
  const at = r.pos;
  r.pos += 2;
  const closing = readName(r);
  skipWhitespace(r);
  expect(r, '>');
  if (closing !== name) {
    fail(r, `</${closing}> closes <${name}>`, at);
  }
}

/**
 * Comments (as `''`) and CDATA sections (as their text) at `r.pos`; `null`
 * when an element starts there.
 */
function readMarkup(r: Reader): string | null {
  if (r.src.startsWith('<!--', r.pos)) {
    readComment(r);
    return '';
  }
  if (r.src.startsWith('<![CDATA[', r.pos)) {
    const end = r.src.indexOf(']]>', r.pos);
    if (end < 0) fail(r, 'the CDATA section is not closed');
    const value = r.src.slice(r.pos + 9, end);
    r.pos = end + 3;
    return value;
  }
  if (r.src.startsWith('<!', r.pos)) fail(r, 'markup declarations are refused');
  if (r.src.startsWith('<?', r.pos)) {
    fail(r, 'processing instructions are not supported');
  }
  return null;
}

function readText(r: Reader): string {
  const next = r.src.indexOf('<', r.pos);
  const end = next < 0 ? r.src.length : next;
  const raw = r.src.slice(r.pos, end);
  const cdataEnd = raw.indexOf(']]>');
  if (cdataEnd >= 0) fail(r, '"]]>" is not allowed in text', r.pos + cdataEnd);
  const value = decode(r, { raw, base: r.pos, attribute: false });
  r.pos = end;
  return value;
}

function decode(
  r: Reader,
  input: { raw: string; base: number; attribute: boolean }
): string {
  const { raw, base, attribute } = input;
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i] ?? '';
    if (ch === '&') {
      const semi = raw.indexOf(';', i);
      if (semi < 0) fail(r, 'the entity reference is not closed', base + i);
      out += resolveReference(r, raw.slice(i + 1, semi), base + i);
      i = semi;
    } else if (attribute && (ch === '\t' || ch === '\n')) out += ' ';
    else out += ch;
  }
  return out;
}

function resolveReference(r: Reader, ref: string, at: number): string {
  const named = NAMED_ENTITIES[ref];
  if (named !== undefined) return named;
  const code = /^#x[0-9A-Fa-f]+$/.test(ref)
    ? Number.parseInt(ref.slice(2), 16)
    : /^#[0-9]+$/.test(ref)
      ? Number.parseInt(ref.slice(1), 10)
      : null;
  if (code === null) fail(r, `unknown entity &${ref};`, at);
  if (!isXmlChar(code)) fail(r, `&${ref}; is not a character XML allows`, at);
  return String.fromCodePoint(code);
}

/** Offset of the first control character XML forbids, or -1. */
function firstForbiddenChar(src: string): number {
  for (let i = 0; i < src.length; i += 1) {
    const code = src.charCodeAt(i);
    const control = code < 0x20 && code !== 0x9 && code !== 0xa;
    if (control || code === 0xfffe || code === 0xffff) return i;
  }
  return -1;
}

function isXmlChar(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}
