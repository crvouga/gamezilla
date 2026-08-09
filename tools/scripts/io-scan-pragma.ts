/**
 * In-file opt-in for Io CI gates — no path allowlists.
 *
 * Composition roots / wall adapters mark themselves with `@io-wall-ok`:
 *
 *   // @io-wall-ok
 *   // or inside a block comment: @io-wall-ok …
 */

const PRAGMA_LINE = /^\s*(?:\/\/|\*|\/\*\*?)\s*@io-wall-ok\b|^\s*@io-wall-ok\b/;

/** True when the file text contains a `@io-wall-ok` pragma comment line. */
export function fileHasIoWallOkPragma(text: string): boolean {
  for (const line of text.split('\n')) {
    if (PRAGMA_LINE.test(line)) return true;
  }
  return false;
}
