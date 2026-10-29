import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { packageLicenseViolations } from './package-licensing';

test('a private package with no license, or UNLICENSED, is clean', () => {
  expect(
    packageLicenseViolations(
      [
        { dir: 'pkgs/a', private: true },
        { dir: 'pkgs/b', private: true, license: 'UNLICENSED' },
      ],
      ['pkgs/a/README.md', 'pkgs/a/NOTICE.md', 'pkgs/a/licenses.ts']
    )
  ).toEqual([]);
});

// regression: first-party-mit-grant
test('a first-party MIT license file or license field is refused', () => {
  // Literal failing input: pkgs/ui-quality-check-server-ts shipped an MIT
  // LICENSE ("ui-quality-check contributors") in a public repository.
  expect(
    packageLicenseViolations(
      [{ dir: 'pkgs/ui-quality-check-server-ts', private: true }],
      ['pkgs/ui-quality-check-server-ts/LICENSE']
    )
  ).toHaveLength(1);
  expect(
    packageLicenseViolations(
      [{ dir: 'pkgs/a', private: true, license: 'MIT' }],
      []
    )
  ).toHaveLength(1);
});

test('a package that could be published is refused', () => {
  for (const flag of [undefined, false, 'true'])
    expect(
      packageLicenseViolations([{ dir: 'pkgs/a', private: flag }], [])
    ).toHaveLength(1);
});

test('every license-file spelling is caught, whatever its case or extension', () => {
  assertProperty(
    'package-license-files',
    fc.property(
      fc.constantFrom('LICENSE', 'License', 'licence', 'COPYING', 'UNLICENSE'),
      fc.constantFrom('', '.md', '.txt', '.MIT'),
      (base, extension) => {
        expect(
          packageLicenseViolations([], [`libs/x/${base}${extension}`])
        ).toHaveLength(1);
      }
    )
  );
});
