/** @jsxImportSource hono/jsx */
/**
 * Inline pre-paint script: must run before the stylesheet is applied so
 * the first paint matches the user's resolved theme — we never flash the
 * wrong palette in dark mode. Reads `dev-idp.theme` from localStorage
 * (`light` | `dark` | `system`, defaulting to `system`) and resolves
 * `system` against `prefers-color-scheme` synchronously.
 *
 * Lives as a JSX component so it can be composed into the head of the
 * page from {@link ./page}; we still ship the bytes as a string via
 * `dangerouslySetInnerHTML` because `hono/jsx` doesn't run script content
 * through any escaping that would survive `<` characters in user code.
 */

const SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem('dev-idp.theme');
    var pref =
      stored === 'light' || stored === 'dark' || stored === 'system'
        ? stored
        : 'system';
    var resolved =
      pref === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : pref;
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-pref', pref);
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-theme-pref', 'system');
  }
})();`;

export const ThemePrePaintScript = () => (
  <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
);
