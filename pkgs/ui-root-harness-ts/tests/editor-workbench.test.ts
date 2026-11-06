import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// regression: sokoban-editor-publish-below-fold — wide, the editor's board
// took a fixed 520px measure, so on a 900px window the builder's last step
// (check and publish) and its steps were cut by the window's foot. The
// canvas now takes at most what the window's height leaves for it.
test("wide, the canvas's measure is capped by the window's height", () => {
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../ui-root-client-ts/src/editor-workbench/editor-workbench.module.css'
    ),
    'utf8'
  );
  const wide = css.slice(
    css.indexOf('@container editor-workbench (min-width: 720px)')
  );
  expect(wide).toMatch(
    /grid-template-columns:\s*minmax\(0, clamp\(360px, calc\(100dvh - \d+px\), 520px\)\)/
  );
});
