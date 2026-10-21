import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGUAGES } from './languages';
import { workspaceManifests } from './package-hosts';

const ROOT = join(import.meta.dirname, '../../..');

/**
 * The TypeScript packages named before every name ended in its language
 * suffix, frozen when the rule landed. It only shrinks: renaming a package to
 * `-ts` removes its entry, and a new package is never added. Raising this
 * number is the one way to grow the list, and it is a reviewed change.
 */
const FROZEN_SIZE = 332;

const legacy = JSON.parse(
  readFileSync(join(import.meta.dirname, 'legacy-package-names.json'), 'utf8')
) as string[];

test('the legacy baseline never grows', () => {
  expect(legacy.length).toBeLessThanOrEqual(FROZEN_SIZE);
});

test('the legacy baseline is sorted and holds each name once', () => {
  expect(legacy).toEqual([...new Set(legacy)].sort());
});

test('every legacy entry is a TypeScript package that still lacks its suffix', () => {
  const manifests = new Map(
    workspaceManifests(ROOT).map((manifest) => [manifest.name, manifest])
  );
  const stale = legacy.filter((name) => {
    const manifest = manifests.get(name) as { language?: string } | undefined;
    return (
      manifest === undefined ||
      manifest.language !== 'typescript' ||
      name.endsWith(`-${LANGUAGES.typescript.suffix}`)
    );
  });
  // A renamed or deleted package leaves the list in the same change.
  expect(stale).toEqual([]);
});
