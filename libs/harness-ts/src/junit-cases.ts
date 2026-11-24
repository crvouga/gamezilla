/**
 * The `<testcase>` elements of the JUnit XML `bun test` writes, read without
 * an XML library. A case inherits `file` from the nearest suite that names
 * one, and fails when it holds a `<failure>` or an `<error>`.
 */

export type JunitCase = {
  /** The case's `file` attribute, else its suite's, else empty. */
  readonly file: string;
  readonly name: string;
  /** 1-based line of the test declaration, when the runner emits it. */
  readonly line: number | null;
  readonly status: 'passed' | 'failed' | 'skipped';
  /** The failure's text (else its `message`, else `failed`), or null. */
  readonly failure: string | null;
};

const ELEMENT =
  /<testsuite\b([^>]*?)(\/?)>|<\/testsuite>|<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decode(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (whole, entity: string) => {
      if (entity.startsWith('#x'))
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith('#'))
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      return ENTITIES[entity.toLowerCase()] ?? whole;
    }
  );
}

function attribute(attributes: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attributes);
  return match === null ? null : decode(match[1] ?? '');
}

function text(body: string): string {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(body);
  return cdata === null ? decode(body).trim() : (cdata[1] ?? '');
}

function failureOf(body: string): string | null {
  const match = /<(failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/.exec(
    body
  );
  if (match === null) return null;
  const detail = text(match[3] ?? '');
  if (detail !== '') return detail;
  const message = attribute(match[2] ?? '', 'message') ?? '';
  return message === '' ? 'failed' : message;
}

function caseOf(
  attributes: string,
  body: string,
  suiteFile: string
): JunitCase {
  const failure = failureOf(body);
  const line = Number.parseInt(attribute(attributes, 'line') ?? '', 10);
  return {
    file: attribute(attributes, 'file') ?? suiteFile,
    name: attribute(attributes, 'name') ?? '',
    line: Number.isInteger(line) ? line : null,
    status:
      failure !== null
        ? 'failed'
        : /<skipped\b/.test(body)
          ? 'skipped'
          : 'passed',
    failure,
  };
}

/** Every `<testcase>` in document order, whatever the nesting of its suites. */
export function parseJunit(xml: string): JunitCase[] {
  const cases: JunitCase[] = [];
  const files: string[] = [];
  for (const match of xml.matchAll(ELEMENT)) {
    const [element, suite, selfClosing, testcase, body] = match;
    if (element === '</testsuite>') files.pop();
    else if (testcase !== undefined)
      cases.push(caseOf(testcase, body ?? '', files.at(-1) ?? ''));
    else if (selfClosing !== '/')
      files.push(attribute(suite ?? '', 'file') ?? files.at(-1) ?? '');
  }
  return cases;
}
