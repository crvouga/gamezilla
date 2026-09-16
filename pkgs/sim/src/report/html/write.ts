import { writeUtf8 } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';

import { type HtmlReportBundle, readRunBundle } from './bundle';
import { applyJunitOutcomes, parseJunit } from './junit';
import { type RenderHtmlReportOptions, renderHtmlReport } from './render';

export const HTML_REPORT_KEY = 'index.html';

export type BuildHtmlReportOptions = RenderHtmlReportOptions & {
  /** Bucket that holds `runs/<runId>/…`. */
  readonly store: ObjectStore;
  readonly runId: string;
  /** Optional JUnit XML from the test runner to overlay outcomes / titles. */
  readonly junitXml?: string;
};

/** Read one run and render it to HTML (no writes). */
export async function buildHtmlReport(
  options: BuildHtmlReportOptions
): Promise<{ readonly html: string; readonly bundle: HtmlReportBundle }> {
  let bundle = await readRunBundle(options.store, options.runId);
  if (options.junitXml !== undefined) {
    bundle = applyJunitOutcomes(bundle, parseJunit(options.junitXml));
  }
  const html = renderHtmlReport(bundle, options);
  return { html, bundle };
}

export type WriteHtmlReportOptions = BuildHtmlReportOptions & {
  /** Destination store (e.g. a Node-FS store rooted at the artifact dir). */
  readonly out: ObjectStore;
  /** Key under `out`. Default `index.html`. */
  readonly key?: string;
};

/** Build and persist the standalone report; returns the rendered bundle. */
export async function writeHtmlReport(
  options: WriteHtmlReportOptions
): Promise<HtmlReportBundle> {
  const { html, bundle } = await buildHtmlReport(options);
  await writeUtf8(
    options.out,
    options.key ?? HTML_REPORT_KEY,
    html,
    'text/html; charset=utf-8'
  );
  return bundle;
}
