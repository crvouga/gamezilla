#!/usr/bin/env bun
// @io-wall-ok — package manifest gate entry (`@libs/tools-harness-ts#ci:package-names`).
/**
 * Fails when any workspace package breaks the name convention
 * (`package-names.ts`) or could license or publish proprietary code
 * (`package-licensing.ts`). Reads the manifests and lists each package root,
 * nothing else, so it is a few milliseconds and its cache key is only those
 * files.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LICENSE_FILE,
  type LicensedPackage,
  packageLicenseViolations,
} from './package-licensing';
import { type NamedPackage, packageNameViolations } from './package-names';

const ROOT = join(import.meta.dirname, '../../..');

function workspacePackages(): readonly (NamedPackage & LicensedPackage)[] {
  const out: (NamedPackage & LicensedPackage)[] = [];
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
const violations = packageNameViolations(packages);
if (violations.length > 0) {
  console.error(
    `package names (docs/POLYGLOT.md#names):\n  ${violations.join('\n  ')}`
  );
  process.exit(1);
}
console.log(`package names: ${packages.length} packages follow the convention`);

const licenseFiles = packages.flatMap((pkg) =>
  readdirSync(join(ROOT, pkg.dir))
    .filter((file) => LICENSE_FILE.test(file))
    .map((file) => `${pkg.dir}/${file}`)
);
const licensing = packageLicenseViolations(packages, licenseFiles);
if (licensing.length > 0) {
  console.error(
    `package licensing (LICENSE: proprietary, all rights reserved):\n  ${licensing.join('\n  ')}`
  );
  process.exit(1);
}
console.log(
  `package licensing: ${packages.length} packages are private and unlicensed`
);
