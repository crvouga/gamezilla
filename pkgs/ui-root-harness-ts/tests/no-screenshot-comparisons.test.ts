import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const HARNESS = join(import.meta.dirname, '..');
const SOURCES = /\.(?:[cm]?tsx?)$/;
/** Playwright's and Bun's ways of comparing against a stored picture or dump. */
const COMPARISON =
  /toHaveScreenshot|toMatchSnapshot|toMatchInlineSnapshot|snapshotPathTemplate/;
/**
 * Compares two captures of one run with each other (fonts held back, then
 * ready) and writes its reference under `.cache`: nothing is committed.
 */
const SAME_RUN = join('tests', 'storybook', 'font-readiness.checks.ts');

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sources(path);
    return SOURCES.test(entry.name) && path !== import.meta.path ? [path] : [];
  });
}

test('no browser check compares a story against a stored picture', () => {
  // Golden screenshots need re-authoring after every intended change and
  // fail for reasons a reader cannot see. A story's own play function, the
  // accessibility run and the layout checks say what it must show.
  const comparing = ['storybook', 'tests']
    .flatMap((directory) => sources(join(HARNESS, directory)))
    .filter((path) => !path.endsWith(SAME_RUN))
    .filter((path) => COMPARISON.test(readFileSync(path, 'utf8')));
  expect(comparing).toEqual([]);
});
