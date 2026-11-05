import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(
  join(
    import.meta.dirname,
    '../../ui-root-client-ts/src/preview-thumbnail/preview-thumbnail.module.css'
  ),
  'utf8'
);

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${selector} has no rule`);
  return css.slice(start, css.indexOf('}', start));
}

// regression: content-library-pack-title-offset — a pack's stacked
// thumbnail took a 0.25rem margin beside and above its square, so in the
// puzzle library the title of a pack ("Counting starter pack", "Old
// count") started 4px right of a puzzle's. The second sheet is now drawn
// inside the same square, so every row's title starts at one edge.
test("a stacked thumbnail keeps a single thumbnail's square", () => {
  expect(css).not.toMatch(/\.thumbnail\[data-stacked="true"\]\s*\{[^}]*margin/);
  expect(rule('.thumbnail[data-stacked="true"]::before')).toMatch(
    /inset:\s*0 0 0\.25rem 0\.25rem;/
  );
  expect(rule('.thumbnail[data-stacked="true"] > .frame')).toMatch(
    /margin:\s*0\.25rem 0\.25rem 0 0;/
  );
});
