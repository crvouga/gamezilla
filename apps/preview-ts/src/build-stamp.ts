/**
 * The commit a bundle is deployed at, written into its page. A harness bundle
 * is built from its sources alone and names no commit (so the same bundle is
 * restored for every commit that changes none of them); the deploy says which
 * commit this one is, in a script the page runs before the bundle's own.
 * Documents are never cached (`no-store`), so a page always carries the stamp
 * of the deploy that served it.
 */

export type BuildStamp = {
  readonly commit: string;
  /** The commit's date, as git prints it (`%cI`). */
  readonly date: string;
};

const STAMP = /<script data-build>[^<]*<\/script>/g;

/** `html` carrying `build`, and no stamp it carried before. */
export function stampedPage(html: string, build: BuildStamp): string {
  const page = html.replace(STAMP, '');
  if (!page.includes('<head>'))
    throw new Error('the page has no <head> to carry its build');
  // JSON, with the one character that could close the script escaped.
  const value = JSON.stringify(build).replaceAll('<', '\\u003c');
  return page.replace(
    '<head>',
    `<head><script data-build>globalThis.__BUILD__=${value}</script>`
  );
}
