export const PHONE_W = 390;
export const PHONE_H = 844;

const SHELL_LINK_RE =
  /<link\b[^>]*href=["'][^"']*snapshot-shell\.css["'][^>]*>\s*/gi;
const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;

export function zoomScale(mode: string, wrapW: number, wrapH: number): number {
  if (mode === '50') return 0.5;
  if (mode === '75') return 0.75;
  if (mode === '100') return 1;
  const s = Math.min(1, (wrapW - 8) / PHONE_W, (wrapH - 8) / PHONE_H);
  return !Number.isFinite(s) || s <= 0 ? 0.4 : s;
}

/** Drop scripts and the external shell stylesheet (frameCss replaces it). */
export function cleanSnapshotHtml(html: string): string {
  return html.replace(SCRIPT_RE, '').replace(SHELL_LINK_RE, '');
}
