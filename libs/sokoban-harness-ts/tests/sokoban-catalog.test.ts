import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Component tests render with an empty catalog, so a message missing from
// the checked-in English catalog only shows up in the built app.
const catalog = readFileSync(
  join(import.meta.dir, '../../app-root-shared-ts/locales/en/messages.po'),
  'utf8'
);

// regression: sokoban-counts-show-raw-placeholders
test('the counts and close view read as words in the built app, not placeholders', () => {
  for (const message of [
    'Moves {0}',
    'Pushes {0}',
    'Look closer',
    'Show whole board',
    'Not added: four moves waiting.',
    'More puzzles',
  ]) {
    expect(catalog).toContain(`msgid "${message}"\nmsgstr "${message}"`);
  }
});
