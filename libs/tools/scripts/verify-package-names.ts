#!/usr/bin/env bun
// @io-wall-ok — package name gate entry (`@libs/tools#ci:package-names`).
/**
 * Fails when any workspace package breaks the name convention
 * (`package-names.ts`). Reads the manifests and the legacy list, nothing
 * else, so it is a few milliseconds and its cache key is only those files.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type NamedPackage, packageNameViolations } from './package-names';

const ROOT = join(import.meta.dirname, '../../..');

function workspacePackages(): readonly NamedPackage[] {
  const out: NamedPackage[] = [];
  for (const tier of ['apps', 'libs', 'pkgs'])
    for (const entry of readdirSync(join(ROOT, tier)).sort()) {
      const file = join(ROOT, tier, entry, 'package.json');
      if (!existsSync(file)) continue;
      out.push({
        ...(JSON.parse(readFileSync(file, 'utf8')) as object),
        dir: `${tier}/${entry}`,
      });
    }
  return out;
}

const packages = workspacePackages();
const violations = packageNameViolations(
  packages,
  JSON.parse(
    readFileSync(join(import.meta.dirname, 'legacy-package-names.json'), 'utf8')
  ) as string[]
);
if (violations.length > 0) {
  console.error(
    `package names (docs/POLYGLOT.md#names):\n  ${violations.join('\n  ')}`
  );
  process.exit(1);
}
console.log(`package names: ${packages.length} packages follow the convention`);
