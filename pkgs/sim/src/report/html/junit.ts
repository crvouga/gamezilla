/**
 * Overlay test-runner outcomes (JUnit XML) onto a report bundle. A sim run
 * only sees failures raised inside its own steps; assertions in the test body
 * surface through the runner's report instead.
 */

import type { HtmlReportBundle, HtmlReportTest } from './bundle';

export type JunitCase = {
  readonly file: string;
  readonly name: string;
  /** 1-based line of the test declaration, when the runner emits it. */
  readonly line: number | null;
  readonly status: 'passed' | 'failed' | 'skipped';
  readonly failure: string | null;
};

const ENTITIES: Readonly<Record<string, string>> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&amp;': '&',
};

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&(lt|gt|quot|apos|amp);/g, (m) => ENTITIES[m] ?? m);
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m === null ? null : decodeXml(m[1] ?? '');
}

function failureText(body: string): string | null {
  const m = /<failure\b([^>]*)(?:\/>|>([\s\S]*?)<\/failure>)/.exec(body);
  if (m === null) return null;
  const message = attr(m[1] ?? '', 'message');
  const inner = (m[2] ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const text = decodeXml(inner).trim();
  return text.length > 0 ? text : (message ?? 'failed');
}

function parseCase(tag: string, inner: string, suiteFile: string): JunitCase {
  const lineRaw = attr(tag, 'line');
  const line = lineRaw === null ? null : Number(lineRaw);
  const failure = failureText(inner);
  return {
    file: attr(tag, 'file') ?? suiteFile,
    name: attr(tag, 'name') ?? '',
    line: line !== null && Number.isFinite(line) ? line : null,
    status: caseStatus(failure, inner),
    failure,
  };
}

function caseStatus(
  failure: string | null,
  inner: string
): JunitCase['status'] {
  if (failure !== null) return 'failed';
  if (/<skipped\b/.test(inner)) return 'skipped';
  return 'passed';
}

function parseSuite(tag: string, body: string, out: JunitCase[]): void {
  const suiteFile = attr(tag, 'file') ?? '';
  const caseRe = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  for (let c = caseRe.exec(body); c; c = caseRe.exec(body)) {
    out.push(parseCase(c[1] ?? '', c[2] ?? '', suiteFile));
  }
}

/** Parse the `<testcase>` elements of a JUnit XML document. */
export function parseJunit(xml: string): JunitCase[] {
  const cases: JunitCase[] = [];
  const suiteRe = /<testsuite\b([^>]*)>([\s\S]*?)<\/testsuite>/g;
  for (let suite = suiteRe.exec(xml); suite; suite = suiteRe.exec(xml)) {
    parseSuite(suite[1] ?? '', suite[2] ?? '', cases);
  }
  return cases;
}

function sameFile(a: string, b: string): boolean {
  const na = a.replace(/\\/g, '/');
  const nb = b.replace(/\\/g, '/');
  return na === nb || na.endsWith(`/${nb}`) || nb.endsWith(`/${na}`);
}

/**
 * The test case whose declaration precedes `sourceLine` in the same file and
 * is the nearest one (bodies follow declarations).
 */
export function matchJunitCase(
  cases: readonly JunitCase[],
  sourceFile: string,
  sourceLine: number | undefined
): JunitCase | null {
  const inFile = cases.filter((c) => sameFile(c.file, sourceFile));
  if (inFile.length === 0) return null;
  if (inFile.length === 1 || sourceLine === undefined) return inFile[0]!;
  let best: JunitCase | null = null;
  for (const c of inFile) {
    if (c.line === null || c.line > sourceLine) continue;
    if (best === null || (best.line ?? 0) < c.line) best = c;
  }
  return best;
}

function overlayTest(test: HtmlReportTest, c: JunitCase): HtmlReportTest {
  const failed = c.status === 'failed' || test.report.meta.status === 'failed';
  const status = failed ? 'failed' : c.status;
  const error =
    test.report.meta.error ?? (c.failure !== null ? c.failure : undefined);
  return {
    ...test,
    report: {
      ...test.report,
      meta: {
        ...test.report.meta,
        title: c.name.length > 0 ? c.name : test.report.meta.title,
        status,
        ...(error !== undefined ? { error } : {}),
      },
    },
  };
}

/** Apply runner outcomes / titles to every test with a known source file. */
export function applyJunitOutcomes(
  bundle: HtmlReportBundle,
  cases: readonly JunitCase[]
): HtmlReportBundle {
  const tests = bundle.tests.map((test) => {
    const { sourceFile, sourceLine } = test.report.meta;
    if (sourceFile === undefined) return test;
    const c = matchJunitCase(cases, sourceFile, sourceLine);
    return c === null ? test : overlayTest(test, c);
  });
  const failed = tests.some((t) => t.report.meta.status === 'failed');
  return { ...bundle, tests, status: failed ? 'failed' : bundle.status };
}
