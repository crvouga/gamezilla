/**
 * Beside a wide profile's sections, the identity is a card as tall as its
 * own content: never stretched to the sections' height with the face
 * floating in the middle of an empty box.
 */

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LAYOUTS_CSS = join(
  import.meta.dirname,
  '../../ui-root-client-ts/src/screen-layouts.module.css'
);

/** The body of the first rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule ${selector}`);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

// regression: profile-identity-card-stretched
test('the wide profile grid lines its columns up at the top, at their own heights', () => {
  const css = readFileSync(LAYOUTS_CSS, 'utf8');
  const grid = rule(css, '.profile[data-split="true"]');
  expect(grid).toMatch(/align-items:\s*start;/);
  const card = rule(
    css,
    '.profile[data-split="true"] > .profileAside > .identity'
  );
  expect(card).not.toMatch(/\bflex:\s*1\b/);
  expect(card).not.toMatch(/justify-content:\s*center/);
});
