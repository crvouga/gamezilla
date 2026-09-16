/**
 * Render a report bundle into one self-contained HTML document — every test,
 * step, and snapshot frame is embedded, so the file can be opened from disk,
 * attached to CI, or emailed like a Playwright HTML report.
 */

import type { HtmlReportBundle } from './bundle';
import { VIEWER_CSS } from './viewer-css';
import { VIEWER_JS_DATA } from './viewer-js-data';
import { VIEWER_JS_DETAIL } from './viewer-js-detail';
import { VIEWER_JS_LIST } from './viewer-js-list';

export type RenderHtmlReportOptions = {
  /** Document / header title. Default `Sim report`. */
  readonly title?: string;
  /**
   * CSS injected into every HTML frame preview (the app's compiled
   * stylesheet), so snapshots render like the product did.
   */
  readonly frameCss?: string;
};

/** Safe to inline in `<script>` / `<style>` bodies. */
function escapeInline(text: string): string {
  return text.replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderHtmlReport(
  bundle: HtmlReportBundle,
  options: RenderHtmlReportOptions = {}
): string {
  const title = options.title ?? 'Sim report';
  const data = JSON.stringify({ ...bundle, title });
  const frameCss = options.frameCss ?? '';
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${escapeInline(VIEWER_CSS)}</style>`,
    '</head>',
    '<body>',
    '<div id="app" class="app"></div>',
    `<script id="report-data" type="application/json">${escapeInline(data)}</script>`,
    `<script id="frame-css" type="text/css">${escapeInline(frameCss)}</script>`,
    `<script>${escapeInline(VIEWER_JS_DATA + VIEWER_JS_LIST + VIEWER_JS_DETAIL)}</script>`,
    '</body>',
    '</html>',
  ].join('\n');
}
