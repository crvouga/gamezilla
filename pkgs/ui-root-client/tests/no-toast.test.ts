/**
 * The design system has no toast, and none comes back: what became of an
 * action is told in context — the control's own feedback face or an inline
 * `Notice` where the thing lives — never in a toast or a snackbar floating
 * over the screen (README rule 11).
 */

import { describe, expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const SRC = join(import.meta.dir, '..', 'src');
const FLOATING_NOTE = /toast|snackbar/i;

async function sourceFiles(): Promise<readonly string[]> {
  const entries = await readdir(SRC, { recursive: true });
  return entries.filter((name) => /\.(tsx?|css)$/.test(name));
}

describe('no toast', () => {
  test('no module is a toast or a snackbar', async () => {
    const files = await sourceFiles();
    expect(files.length).toBeGreaterThan(100);
    expect(files.filter((name) => FLOATING_NOTE.test(name))).toEqual([]);
  });

  test('no source names, exports or imports a toast or a snackbar', async () => {
    const offenders: string[] = [];
    for (const name of await sourceFiles()) {
      const text = await Bun.file(join(SRC, name)).text();
      const lines = text.split('\n');
      for (const [index, line] of lines.entries()) {
        if (FLOATING_NOTE.test(line)) offenders.push(`${name}:${index + 1}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
