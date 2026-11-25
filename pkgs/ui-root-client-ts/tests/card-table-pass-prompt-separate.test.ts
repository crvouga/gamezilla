import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sheet = readFileSync(
  join(import.meta.dir, '../src/card-table/card-table.module.css'),
  'utf8'
);

/** The declarations of `selector`'s rule inside `body`. */
function rule(body: string, selector: string): string {
  const start = body.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return body.slice(start, body.indexOf('}', start));
}

// regression: card-table-pass-prompt-covers-direction — while cards were
// passed, the table's drawn prompt ('Choose three cards to pass') and where
// the cards go ('Passing to the left') shared one grid cell, so the prompt
// covered the direction on a phone (and sat over it on a wide table).
test('a passing table draws its prompt beside where the cards go, not over it', () => {
  expect(rule(sheet, '.table > .pass')).toContain('grid-area: pass;');
  const drawn = rule(
    sheet,
    '.table:has(> .pass):has(> .center[data-spoken-only="false"])'
  );
  expect(drawn).toContain('"left pass right"');
  expect(drawn).toContain('"left center right"');
});
