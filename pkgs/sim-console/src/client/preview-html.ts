/** Strip Google Fonts / gstatic preconnect+stylesheet links from snapshot HTML. */
const GOOGLE_FONT_LINK_RE =
  /<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>\s*/gi;

/** Strip linked snapshot-shell.css (relative href fails under srcdoc / in-DOM). */
const SNAPSHOT_SHELL_LINK_RE =
  /<link\b[^>]*href=["'][^"']*snapshot-shell\.css["'][^>]*>\s*/gi;

/** Sandbox iframe previews use opaque origin (no allow-same-origin) — strip executable tags. */
const SCRIPT_TAG_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;

function stripSnapshotScripts(html: string): string {
  return html.replace(SCRIPT_TAG_RE, '');
}

export type PatchPreviewHtmlOptions = {
  readonly fontCss?: string;
  readonly shellCss?: string;
};

export type SnapshotPayload = {
  readonly bodyHtml: string;
  readonly styleHtml: string;
};

function scopeShellCss(shellCss: string): string {
  return shellCss
    .replace(/html,body,\.rn-root/g, '.snapshot-host,.snapshot-host .rn-root')
    .replace(/html,body/g, '.snapshot-host')
    .replace(/(^|[,{\s])html\b/g, '$1.snapshot-host')
    .replace(/(^|[,{\s])body\b/g, '$1.snapshot-host')
    .replace(/(^|})(\s*)\.rn-root\{/g, '$1$2.snapshot-host .rn-root{');
}

function extractBodyHtml(html: string): string {
  const m = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  if (m?.[1] !== undefined) return m[1];
  return html;
}

/** Launch/nav shells are ~3KB of empty flex chrome with no visible copy. */
const SHELL_ONLY_BODY_MAX = 4000;

/**
 * True when a prepared snapshot body has no visible text (and optionally is a
 * tiny empty shell). Used to hold the previous painted frame instead of swapping.
 */
export function isBlankSnapshotBody(bodyHtml: string): boolean {
  const text = bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (text.length === 0) return true;
  // Tiny bodies with almost no copy are still empty shells (spinner-only, etc.).
  if (bodyHtml.length < SHELL_ONLY_BODY_MAX && text.length < 8) return true;
  return false;
}

/**
 * Prepare snapshot HTML for in-DOM mounting: strip remote links, extract body,
 * and build scoped style blocks for the snapshot host.
 */
export function prepareSnapshotHtml(
  html: string,
  options: PatchPreviewHtmlOptions = {}
): SnapshotPayload {
  const cleaned = stripSnapshotScripts(
    html.replace(GOOGLE_FONT_LINK_RE, '').replace(SNAPSHOT_SHELL_LINK_RE, '')
  );
  const bodyHtml = extractBodyHtml(cleaned);
  const styles: string[] = [];
  const shell = options.shellCss?.trim() ?? '';
  const font = options.fontCss?.trim() ?? '';
  if (shell.length > 0) {
    styles.push(`<style>${scopeShellCss(shell)}</style>`);
  }
  if (font.length > 0) styles.push(`<style>${font}</style>`);
  return { bodyHtml, styleHtml: styles.join('') };
}

/**
 * Full-document HTML for iframe `srcdoc`: strip remote links and inject
 * unscoped shell + font CSS into `<head>` (html/body/.rn-root height chain).
 */
export function patchPreviewHtml(
  html: string,
  fontCssOrOptions: string | PatchPreviewHtmlOptions = ''
): string {
  const options: PatchPreviewHtmlOptions =
    typeof fontCssOrOptions === 'string'
      ? { fontCss: fontCssOrOptions }
      : fontCssOrOptions;
  const cleaned = stripSnapshotScripts(
    html.replace(GOOGLE_FONT_LINK_RE, '').replace(SNAPSHOT_SHELL_LINK_RE, '')
  );
  const bodyHtml = extractBodyHtml(cleaned);
  const styles: string[] = [];
  const shell = options.shellCss?.trim() ?? '';
  const font = options.fontCss?.trim() ?? '';
  if (shell.length > 0) styles.push(`<style>${shell}</style>`);
  if (font.length > 0) styles.push(`<style>${font}</style>`);
  return `<!DOCTYPE html><html><head>${styles.join('')}</head><body>${bodyHtml}</body></html>`;
}

/** Body-only fingerprint for blank / identical checks (iframe or in-DOM). */
export function snapshotBodyHtml(html: string): string {
  return extractBodyHtml(
    html.replace(GOOGLE_FONT_LINK_RE, '').replace(SNAPSHOT_SHELL_LINK_RE, '')
  );
}
