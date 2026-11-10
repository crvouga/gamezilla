import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sheet = readFileSync(
  join(import.meta.dir, '../src/card-table/card-table.module.css'),
  'utf8'
);

/** The body of the container query opened by `query`, braces balanced. */
function block(query: string): string {
  const start = sheet.indexOf(query);
  expect(start).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let at = sheet.indexOf('{', start); at < sheet.length; at += 1) {
    if (sheet[at] === '{') depth += 1;
    if (sheet[at] === '}') depth -= 1;
    if (depth === 0) return sheet.slice(start, at);
  }
  throw new Error(`Unclosed block: ${query}`);
}

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
  const phone = block('@container card-table not (min-width: 30rem)');
  expect(rule(phone, '  .pass,\n  .center')).toContain('grid-row: 3;');
  expect(rule(phone, '.table:has(> .pass) > .center')).toContain(
    'grid-row: 4;'
  );
  const wide = block('@container (min-width: 30rem)');
  expect(rule(wide, '.table > .pass')).toContain('grid-area: pass;');
  const drawn = rule(
    wide,
    '.table:has(> .pass):has(> .center[data-spoken-only="false"])'
  );
  expect(drawn).toContain('"left pass right"');
  expect(drawn).toContain('"left center right"');
});
