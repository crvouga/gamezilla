/** Strip Google Fonts / gstatic preconnect+stylesheet links from snapshot HTML. */
const GOOGLE_FONT_LINK_RE =
  /<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>\s*/gi;

/**
 * Replace network font links with injected CSS (parent-preloaded Nunito) so
 * srcdoc frames do not refetch fonts or flash with `display=swap`.
 */
export function patchPreviewHtml(html: string, fontCss: string): string {
  const withoutLinks = html.replace(GOOGLE_FONT_LINK_RE, '');
  const inject = fontCss.trim().length > 0 ? `<style>${fontCss}</style>` : '';
  if (inject.length === 0) return withoutLinks;
  if (/<\/head>/i.test(withoutLinks)) {
    return withoutLinks.replace(/<\/head>/i, `${inject}</head>`);
  }
  return `${inject}${withoutLinks}`;
}
