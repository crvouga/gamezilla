import { describe, expect, test } from 'bun:test';
import {
  type LanguageManifest,
  languageViolations,
  type NativeFiles,
  nativeGraphViolations,
  nativeSourceViolations,
} from './language-boundaries';
import { languageOfName, withoutLanguageSuffix } from './languages';
import { categoryOfName } from './package-boundaries';

const WORKSPACE = new Map<string, LanguageManifest>([
  [
    '@pkgs/clock-shared-swift',
    { language: 'swift', platforms: ['linux', 'macos', 'ios'] },
  ],
  ['@pkgs/apple-only-client-swift', { language: 'swift', platforms: ['ios'] }],
  ['@pkgs/value-shared', { language: 'typescript' }],
  ['@pkgs/game-protocol', { language: 'neutral' }],
]);

const options = {
  tier: 'pkgs',
  workspace: WORKSPACE,
  legacy: new Set(['@pkgs/value-shared']),
};

const violations = (manifest: LanguageManifest) =>
  languageViolations(manifest, options);

describe('names spell the declared language', () => {
  test('the suffix comes last and the category before it', () => {
    expect(languageOfName('@pkgs/clock-shared-swift')).toBe('swift');
    expect(languageOfName('@pkgs/codegen-root-server-ts')).toBe('typescript');
    expect(languageOfName('@pkgs/game-protocol')).toBeUndefined();
    expect(withoutLanguageSuffix('@pkgs/clock-shared-swift')).toBe(
      '@pkgs/clock-shared'
    );
    expect(categoryOfName('@pkgs/clock-shared-swift')).toBe('isomorphic');
    expect(categoryOfName('@pkgs/friends-root-server-rust')).toBe('server');
    expect(categoryOfName('@pkgs/clock-shared')).toBe('isomorphic');
  });

  test('a new package ends in its language suffix; only the frozen baseline may not', () => {
    expect(
      violations({ name: '@pkgs/new-shared-ts', language: 'typescript' })
    ).toEqual([]);
    expect(
      violations({ name: '@pkgs/value-shared', language: 'typescript' })
    ).toEqual([]);
    expect(
      violations({ name: '@pkgs/new-shared', language: 'typescript' })
    ).toEqual([
      '@pkgs/new-shared is typescript, so its name ends in -ts (only the frozen legacy-package-names.json may omit it)',
    ]);
    expect(
      violations({
        name: '@pkgs/clock-shared',
        language: 'swift',
        platforms: ['linux'],
      })
    ).toEqual([expect.stringContaining('ends in -swift')]);
  });

  test('a name never spells another language than it declares', () => {
    expect(
      violations({ name: '@pkgs/a-shared-swift', language: 'typescript' })
    ).toEqual([
      '@pkgs/a-shared-swift is typescript but its name spells swift (-swift)',
    ]);
  });

  test('language-neutral packages end in no language suffix', () => {
    expect(
      violations({ name: '@pkgs/sync-contracts', language: 'neutral' })
    ).toEqual([]);
    expect(
      violations({ name: '@pkgs/sync-contracts-ts', language: 'neutral' })
    ).toEqual([
      '@pkgs/sync-contracts-ts is language-neutral, so its name ends in no language suffix (not -ts)',
    ]);
  });

  test('the language is declared, registered and supported', () => {
    expect(violations({ name: '@pkgs/a-shared-ts' })).toEqual([
      expect.stringContaining('declares no language'),
    ]);
    expect(violations({ name: '@pkgs/a-shared-zig', language: 'zig' })).toEqual(
      [expect.stringContaining('declares no language')]
    );
    expect(
      violations({
        name: '@pkgs/a-shared-rust',
        language: 'rust',
        platforms: ['linux'],
      })
    ).toEqual([expect.stringContaining('rust is reserved, not supported yet')]);
  });
});

describe('platforms and dependencies', () => {
  test('native packages declare known platforms', () => {
    expect(
      violations({ name: '@pkgs/a-shared-swift', language: 'swift' })
    ).toEqual(['swift packages declare "platforms" (package-hosts.ts)']);
    expect(
      violations({
        name: '@pkgs/a-shared-swift',
        language: 'swift',
        platforms: ['android'],
      })
    ).toEqual([
      '"platforms" names android, which package-hosts.ts does not know',
    ]);
  });

  test('a package builds only for platforms its dependencies build for', () => {
    expect(
      violations({
        name: '@pkgs/a-client-swift',
        language: 'swift',
        platforms: ['ios'],
        dependencies: { '@pkgs/clock-shared-swift': 'workspace:*' },
      })
    ).toEqual([]);
    expect(
      violations({
        name: '@pkgs/a-shared-swift',
        language: 'swift',
        platforms: ['linux', 'ios'],
        dependencies: { '@pkgs/apple-only-client-swift': 'workspace:*' },
      })
    ).toEqual([
      'builds for linux, which its dependency @pkgs/apple-only-client-swift does not (ios)',
    ]);
  });

  test('implementations meet only through language-neutral packages', () => {
    expect(
      violations({
        name: '@pkgs/a-shared-swift',
        language: 'swift',
        platforms: ['linux'],
        dependencies: {
          '@pkgs/game-protocol': 'workspace:*',
          '@pkgs/value-shared': 'workspace:*',
        },
        // Tooling may cross: a generator written in TypeScript.
        devDependencies: { '@pkgs/value-shared': 'workspace:*' },
      })
    ).toEqual([
      'swift package depends on the typescript package @pkgs/value-shared: implementations meet only through language-neutral packages',
    ]);
    expect(
      violations({
        name: '@pkgs/game-rules',
        language: 'neutral',
        dependencies: { '@pkgs/value-shared': 'workspace:*' },
      })
    ).toEqual([
      'a language-neutral package depends on the typescript package @pkgs/value-shared; neutral contracts depend only on neutral ones',
    ]);
  });

  test('tiers hold for every language', () => {
    expect(
      languageViolations(
        {
          name: '@pkgs/a-shared-swift',
          language: 'swift',
          platforms: ['linux'],
          dependencies: { '@libs/b-shared-swift': 'workspace:*' },
          devDependencies: { '@apps/c-client-swift': 'workspace:*' },
        },
        options
      )
    ).toEqual([
      'dependencies names @libs/b-shared-swift: pkgs/ depend only on pkgs/',
      'devDependencies names the app @apps/c-client-swift: nothing outside apps/ depends on an app',
    ]);
  });
});

function native(
  files: Record<string, string>,
  dir = 'apps/a-client-swift'
): NativeFiles {
  return {
    dir,
    files: Object.keys(files),
    read: (path) => files[path] ?? '',
    packagesByDir: new Map([
      ['pkgs/clock-shared-swift', '@pkgs/clock-shared-swift'],
    ]),
  };
}

const PBXPROJ = (path: string) =>
  `isa = XCLocalSwiftPackageReference;\n\t\t\trelativePath = "${path}";\n`;

describe('the native graph is the package.json graph', () => {
  const app: LanguageManifest = {
    language: 'swift',
    dependencies: { '@pkgs/clock-shared-swift': 'workspace:*' },
  };

  test('an Xcode project references exactly the declared Swift packages', () => {
    expect(
      nativeGraphViolations(
        app,
        native({
          'a.xcodeproj/project.pbxproj': PBXPROJ(
            '../../pkgs/clock-shared-swift'
          ),
        })
      )
    ).toEqual([]);
    expect(
      nativeGraphViolations(
        { language: 'swift' },
        native({
          'a.xcodeproj/project.pbxproj': PBXPROJ(
            '../../pkgs/clock-shared-swift'
          ),
        })
      )
    ).toEqual([
      'a.xcodeproj/project.pbxproj depends on @pkgs/clock-shared-swift; declare it in package.json "dependencies" so Turborepo\'s graph has the edge',
    ]);
    expect(
      nativeGraphViolations(app, native({ 'a.xcodeproj/project.pbxproj': '' }))
    ).toEqual([
      'package.json depends on @pkgs/clock-shared-swift, which no Package.swift or Xcode project references',
    ]);
  });

  test('a local reference resolves to a workspace package', () => {
    expect(
      nativeGraphViolations(
        { language: 'swift' },
        native(
          { 'Package.swift': '.package(path: "../../libs/elsewhere")' },
          'pkgs/b-shared-swift'
        )
      )
    ).toEqual([
      'Package.swift references ../../libs/elsewhere, which is not a workspace package',
    ]);
    expect(
      nativeGraphViolations(
        app,
        native(
          {
            'Package.swift':
              '.package(name: "Clock", path: "../clock-shared-swift")',
          },
          'pkgs/b-shared-swift'
        )
      )
    ).toEqual([]);
  });

  test('remote packages pin their versions in a committed Package.resolved', () => {
    const remote = '.package(url: "https://example.com/a.git", from: "1.0.0")';
    expect(
      nativeGraphViolations(
        { language: 'swift' },
        native({ 'Package.swift': remote })
      )
    ).toEqual([
      'Package.swift has remote packages; commit Package.resolved so every build resolves the same versions',
    ]);
    expect(
      nativeGraphViolations(
        { language: 'swift' },
        native({ 'Package.swift': remote, 'Package.resolved': '{}' })
      )
    ).toEqual([]);
  });

  test('a Swift package has a native manifest', () => {
    expect(
      nativeGraphViolations(
        { language: 'swift' },
        native({ 'src/a.swift': '' })
      )
    ).toEqual([
      'a Swift package has a Package.swift or one .xcodeproj at its root',
    ]);
    expect(
      nativeGraphViolations({ language: 'typescript' }, native({}))
    ).toEqual([]);
  });
});

describe('native sources', () => {
  test('source stays flat', () => {
    expect(
      nativeSourceViolations(
        { language: 'swift', platforms: ['ios'] },
        native({ 'src/a.swift': '', 'src/screens/b.swift': '' })
      )
    ).toEqual([
      'src/screens/b.swift: src must be flat; split a vertical slice into its own package',
    ]);
  });

  test('code built for Linux imports no Apple-only framework', () => {
    expect(
      nativeSourceViolations(
        {
          language: 'swift',
          category: 'isomorphic',
          platforms: ['linux', 'ios'],
        },
        native({
          'src/a.swift':
            'import Foundation\nimport Synchronization\n@preconcurrency import Combine\n',
        })
      )
    ).toEqual(['src/a.swift imports Combine, which does not exist on Linux']);
  });

  test('isomorphic code imports no UI framework, wherever it builds', () => {
    expect(
      nativeSourceViolations(
        { language: 'swift', category: 'isomorphic', platforms: ['ios'] },
        native({ 'src/a.swift': 'import SwiftUI\n' })
      )
    ).toEqual(['src/a.swift imports SwiftUI: isomorphic code draws nothing']);
    expect(
      nativeSourceViolations(
        { language: 'swift', category: 'client', platforms: ['ios'] },
        native({
          'src/a.swift': 'import SwiftUI\n',
          'tests/b.swift': 'import XCTest\n',
        })
      )
    ).toEqual([]);
  });
});
