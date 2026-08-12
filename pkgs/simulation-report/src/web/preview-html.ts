/** Strip Google Fonts / gstatic preconnect+stylesheet links from snapshot HTML. */
const GOOGLE_FONT_LINK_RE =
  /<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>\s*/gi;

/** Strip linked snapshot-shell.css (relative href fails under srcdoc). */
const SNAPSHOT_SHELL_LINK_RE =
  /<link\b[^>]*href=["'][^"']*snapshot-shell\.css["'][^>]*>\s*/gi;

export type PatchPreviewHtmlOptions = {
  readonly fontCss?: string;
  readonly shellCss?: string;
};

/**
 * Strip network font + shell stylesheet links and inject inlined CSS so
 * srcdoc frames paint fully styled without refetch / FOUT.
 */
export function patchPreviewHtml(
  html: string,
  fontCssOrOptions: string | PatchPreviewHtmlOptions = ''
): string {
  const options: PatchPreviewHtmlOptions =
    typeof fontCssOrOptions === 'string'
      ? { fontCss: fontCssOrOptions }
      : fontCssOrOptions;
  const fontCss = options.fontCss ?? '';
  const shellCss = options.shellCss ?? '';

  const out = html
    .replace(GOOGLE_FONT_LINK_RE, '')
    .replace(SNAPSHOT_SHELL_LINK_RE, '');

  const styles: string[] = [];
  if (shellCss.trim().length > 0) styles.push(`<style>${shellCss}</style>`);
  if (fontCss.trim().length > 0) styles.push(`<style>${fontCss}</style>`);
  if (styles.length === 0) return out;

  const inject = styles.join('');
  if (/<\/head>/i.test(out)) {
    return out.replace(/<\/head>/i, `${inject}</head>`);
  }
  return `${inject}${out}`;
}
