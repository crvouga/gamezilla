import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CATALOG = join(
  import.meta.dirname,
  '../../app-root-shared-ts/locales/en/messages.po'
);

// regression: numberlink-drawing-messages-missing-from-catalog
// Production looks messages up by hashed id; a message missing from the
// catalog renders the hash instead of English. The drawing status, saved
// progress and cancel messages shipped without catalog entries.
test('the drawing messages a player reads are in the translation catalog', () => {
  const catalog = readFileSync(CATALOG, 'utf8');
  for (const message of [
    'Drag from an endpoint to its match, or use Enter and arrow keys.',
    'Drawing {0}. Finish on its matching endpoint to save it.',
    'Drawing canceled. Saved paths are unchanged. Start again from an endpoint.',
    'Saved:',
    'Every pair is connected. Your completed paths are shown above.',
  ])
    expect(catalog).toContain(`msgid "${message}"`);
});
