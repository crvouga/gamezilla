import type { ReportStepHit } from '@pkgs/sim';

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

function cssEscape(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function hitSelector(hit: ReportStepHit | undefined): string {
  if (!hit?.path?.length) return '';
  return hit.path.map((id) => `[data-testid="${cssEscape(id)}"]`).join(' ');
}

export function pressCss(hit: ReportStepHit | null | undefined): string {
  const sel = hitSelector(hit ?? undefined);
  if (!sel) return '';
  return `${sel}{outline:2px solid #ff5a8a !important;outline-offset:2px !important;box-shadow:0 0 0 4px rgba(255,90,138,.35) !important;position:relative;z-index:5}`;
}

export function frameSrcdoc(
  html: string,
  frameCss: string,
  hit: ReportStepHit | null | undefined
): string {
  const cleaned = html.replace(SCRIPT_RE, '').replace(SHELL_LINK_RE, '');
  const inject = `<style>${frameCss}${pressCss(hit)}</style>`;
  if (/<\/head>/i.test(cleaned)) {
    return cleaned.replace(/<\/head>/i, `${inject}</head>`);
  }
  return inject + cleaned;
}
