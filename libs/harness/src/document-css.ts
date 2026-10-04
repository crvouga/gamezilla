/** Class the page's own CSS is scoped to. Snapshots keep this style tag. */
export const HARNESS_BROWSER_PAGE_CLASS = 'harness-browser-page';

/** The page's own stylesheets, joined. */
export function documentCss(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('style')]
    .map((style) => style.textContent)
    .join('\n');
}

/**
 * Limit a vendor stylesheet to the page wrapper. `:root` / `html` / `body`
 * become that wrapper, and a full-viewport height becomes the wrapper's
 * height, so the sheet (and a report snapshot of it) paints as the page
 * designed without the rules reaching the rest of the app.
 */
export function scopePageCss(css: string): string {
  const trimmed = css.trim();
  if (trimmed === '') return '';
  // `.` and `#` stay put, so a class such as `.body` is not the page body.
  const rooted = trimmed.replace(
    /(^|[^-\w.#])(:root|html|body)(?![\w-])/g,
    (_match, prefix: string) => `${prefix}:scope`
  );
  const sized = rooted.replace(/\b100(?:d|s|l)?v[hw]\b/g, '100%');
  return `@scope (.${HARNESS_BROWSER_PAGE_CLASS}) {\n${sized}\n}`;
}
