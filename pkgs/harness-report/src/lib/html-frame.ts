import { fmtMs } from './format';
import type { FlatFrame } from './frames';

/**
 * A self-contained HTML document for a frame that has no UI snapshot: a
 * Quint step's model state, or any spec step that only recorded text.
 * Painted in the same phone surface as a real snapshot.
 */

type Section = {
  readonly heading: string;
  readonly body: string;
};

const CARD_CSS = [
  'html,body{margin:0;background:#f4f1ea;color:#1c1915;',
  'font:14px/1.45 ui-sans-serif,system-ui,sans-serif}',
  'article{padding:20px 18px 28px}',
  'h1{font-size:16px;line-height:1.3;margin:0 0 8px}',
  '.meta{color:#6b645b;font-size:12px;margin:0 0 16px}',
  'table{width:100%;border-collapse:collapse;background:#fff;',
  'border:1px solid #e4ddd2;border-radius:10px}',
  'th,td{text-align:left;vertical-align:top;padding:8px 10px;',
  'border-top:1px solid #eee6dc;font-size:12px}',
  'th{width:34%;color:#6b645b;font-weight:600}',
  'td{font-family:ui-monospace,monospace;white-space:pre-wrap}',
  'pre{white-space:pre-wrap;background:#fff;border:1px solid #e4ddd2;',
  'border-radius:10px;padding:10px 12px;font:12px/1.4 ui-monospace,monospace}',
  'h2{font-size:12px;margin:18px 0 6px;color:#6b645b}',
  '.err{color:#9f1239;background:#fff1f2;border:1px solid #fecdd3;',
  'border-radius:10px;padding:10px 12px;white-space:pre-wrap}',
].join('');

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** `name = value` lines (a Quint step's observed state), or null. */
function stateRows(
  detail: string
): readonly { readonly name: string; readonly value: string }[] | null {
  const lines = detail.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) return null;
  const rows: { name: string; value: string }[] = [];
  for (const line of lines) {
    const at = line.indexOf(' = ');
    if (at <= 0) return null;
    rows.push({ name: line.slice(0, at), value: line.slice(at + 3) });
  }
  return rows;
}

function detailBlock(detail: string | undefined): string {
  if (detail === undefined || detail.trim() === '') return '';
  const rows = stateRows(detail);
  if (rows === null) return `<pre>${escapeHtml(detail)}</pre>`;
  const body = rows
    .map(
      (row) =>
        `<tr><th>${escapeHtml(row.name)}</th><td>${escapeHtml(row.value)}</td></tr>`
    )
    .join('');
  return `<table>${body}</table>`;
}

function sectionBlocks(sections: readonly Section[]): string {
  return sections
    .map(
      (section) =>
        `<h2>${escapeHtml(section.heading)}</h2><pre>${escapeHtml(section.body)}</pre>`
    )
    .join('');
}

/** HTML document of one frame's model or recorded state. */
export function stateFrameHtml(
  frame: FlatFrame,
  sections: readonly Section[]
): string {
  const step = frame.step;
  const error =
    step.error === undefined
      ? ''
      : `<pre class="err">${escapeHtml(step.error)}</pre>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CARD_CSS}</style></head><body><article><p class="meta">${escapeHtml(step.kind)} · ${escapeHtml(fmtMs(step.durationMs))} · frame ${escapeHtml(fmtMs(frame.frame.durationMs))}</p><h1>${escapeHtml(step.title)}</h1>${error}${detailBlock(step.detail)}${sectionBlocks(sections)}</article></body></html>`;
}
