/**
 * Runs every feature beside this file (`tests/*.feature`) under `bun test`:
 * one `describe` per feature, one `test` per scenario, each in a fresh world.
 */

import './steps/index';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runFeature } from '@pkgs/gherkin/bun-test';

for (const file of readdirSync(import.meta.dir)
  .filter((name) => name.endsWith('.feature'))
  .sort()) {
  runFeature(readFileSync(join(import.meta.dir, file), 'utf8'), {
    packageName: '@pkgs/room',
    featureUri: `pkgs/room/tests/${file}`,
  });
}
