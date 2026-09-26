import type { HtmlReportBundle } from '@pkgs/sim';

import { ARTIFACT_CSS, ARTIFACT_JS } from './artifact';
import type { ReportData } from './types';

export type RenderHtmlReportOptions = {
  /** Document / header title. Default `Sim report`. */
  readonly title?: string;
  /**
   * CSS injected into every HTML frame preview (the app's compiled
   * stylesheet), so UI snapshots render like the product did.
   */
  readonly frameCss?: string;
};

/** Safe to inline in `<script>` / `<style>` bodies. */
function escapeInline(text: string): string {
  return text.replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
}

/**
 * Safe to inline in a `<script type="application/json">` body and still be
 * valid JSON. Escaping every `<` as `\u003c` neutralises both `</script` and
 * the legacy `<!--` comment opener (Solid markers render literal `<!---->`),
 * where the `escapeInline` backslash tricks would emit `<\!--`, which is not a
 * JSON escape sequence.
 */
function escapeInlineJson(json: string): string {
  return json.replace(/</g, '\\u003c');
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
  const data: ReportData = { ...bundle, title };
  const json = JSON.stringify(data);
  const frameCss = options.frameCss ?? '';
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${escapeInline(ARTIFACT_CSS)}</style>`,
    '</head>',
    '<body style="margin:0;height:100vh">',
    '<sim-report></sim-report>',
    `<script id="report-data" type="application/json">${escapeInlineJson(json)}</script>`,
    `<script id="frame-css" type="text/css">${escapeInline(frameCss)}</script>`,
    `<script>${escapeInline(ARTIFACT_JS)}</script>`,
    '</body>',
    '</html>',
  ].join('\n');
}
