/**
 * The repository is proprietary and public: every workspace package is
 * covered by the root `LICENSE` (all rights reserved), so none may grant a
 * license of its own. A package stays `private` (never published), declares
 * no `license` but `UNLICENSED`, and keeps no license file of its own;
 * third-party material's notices live in `THIRD_PARTY_NOTICES.md` or beside
 * that material.
 */

export type LicensedPackage = {
  readonly dir: string;
  readonly private?: unknown;
  readonly license?: unknown;
};

/** Basenames that grant or state a license when they sit in a package root. */
export const LICENSE_FILE = /^(?:licen[cs]e|copying|unlicense)(?:\.[a-z]+)?$/i;

export function packageLicenseViolations(
  packages: readonly LicensedPackage[],
  rootFiles: readonly string[]
): string[] {
  const violations: string[] = [];
  for (const pkg of packages) {
    if (pkg.private !== true)
      violations.push(
        `${pkg.dir}: set "private": true (proprietary code is never published)`
      );
    if (pkg.license !== undefined && pkg.license !== 'UNLICENSED')
      violations.push(
        `${pkg.dir}: "license": ${JSON.stringify(pkg.license)} grants a license; the repository LICENSE governs every package`
      );
  }
  for (const file of rootFiles) {
    const name = file.split('/').pop() ?? file;
    if (LICENSE_FILE.test(name))
      violations.push(
        `${file}: a package's own license file; the repository LICENSE governs it (third-party notices go in THIRD_PARTY_NOTICES.md)`
      );
  }
  return violations;
}
