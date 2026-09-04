import type { HttpFetch } from '@pkgs/http-client';
import { SNAPSHOT_SHELL_CSS } from '@pkgs/ui-testing-rntl/serialize-host-tree-html';

/** Same family weights as snapshot HTML; `display=block` avoids FOUT swap. */
export const NUNITO_FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=block';

export { SNAPSHOT_SHELL_CSS };

let fontCssPromise: Promise<string> | null = null;

/**
 * Fetch Nunito CSS once (browser caches woff2). Rewrites any residual
 * `font-display: swap` to `block` so preview text waits for the face. Pure
 * helper — the caller injects `fetch` (e.g. a web `.web.tsx` HTML preview).
 */
export function loadPreviewFontCss(httpFetch: HttpFetch): Promise<string> {
  if (fontCssPromise === null) {
    fontCssPromise = httpFetch(NUNITO_FONT_CSS_URL)
      .then(async (res) => {
        if (!res.ok) return '';
        const css = await res.text();
        return css.replace(/font-display\s*:\s*swap/gi, 'font-display:block');
      })
      .catch(() => '');
  }
  return fontCssPromise;
}
