import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  prepareReleasePublic,
  releaseArtifacts,
  removeReleaseArtifacts,
  writeReleaseStubs,
} from './release-artifacts';
import { parseReleasePart } from './release-selection';

const REPO_ROOT = resolve(import.meta.dir, '../../..');

// regression: release-partition-artifact-race
test('preparing part 1/3 preserves part 0/3 custom-game and sokoban stubs', () => {
  const packageDir = mkdtempSync(join(tmpdir(), 'release-partitions-'));
  const first = releaseArtifacts(packageDir, parseReleasePart(['--part=0/3']));
  const second = releaseArtifacts(packageDir, parseReleasePart(['--part=1/3']));
  try {
    writeReleaseStubs(
      packageDir,
      [
        join(REPO_ROOT, 'specs/journeys/custom-game.feature'),
        join(REPO_ROOT, 'specs/journeys/sokoban-packs.feature'),
      ],
      first
    );
    const files = [
      'journeys-custom-game.feature.test.ts',
      'journeys-sokoban-packs.feature.test.ts',
    ].map((name) => join(first.stubDir, name));
    const before = files.map((file) => readFileSync(file, 'utf8'));
    writeReleaseStubs(
      packageDir,
      [join(REPO_ROOT, 'specs/journeys/numberlink-packs.feature')],
      second
    );
    expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(before);
    removeReleaseArtifacts(second, false);
    expect(files.map((file) => readFileSync(file, 'utf8'))).toEqual(before);
  } finally {
    removeTree(packageDir, { whenLocked: 'leave' });
  }
});

function putFile(path: string, content: string): void {
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

test('every partition preserves sibling bundles, reports, assets and evidence during preparation and cleanup', () => {
  const pair = fc.integer({ min: 2, max: 12 }).chain((parts) =>
    fc
      .tuple(
        fc.integer({ min: 0, max: parts - 1 }),
        fc.integer({ min: 1, max: parts - 1 })
      )
      .map(
        ([part, offset]) =>
          [
            { part, parts },
            { part: (part + offset) % parts, parts },
          ] as const
      )
  );
  assertProperty(
    'release partitions own disjoint mutable artifacts',
    fc.property(pair, ([first, second]) => {
      const packageDir = mkdtempSync(join(tmpdir(), 'release-ownership-'));
      const survivor = releaseArtifacts(packageDir, first);
      const finishing = releaseArtifacts(packageDir, second);
      try {
        const paths = Object.entries(survivor)
          .filter(([key]) => key !== 'scratchDir')
          .map(([, dir]) => join(dir, 'still-in-use'));
        for (const file of paths) putFile(file, file);
        putFile(join(packageDir, 'public/favicon.ico'), 'static');
        prepareReleasePublic(packageDir, finishing);
        writeReleaseStubs(
          packageDir,
          [join(REPO_ROOT, 'specs/journeys/custom-game.feature')],
          finishing
        );
        removeReleaseArtifacts(finishing, false);
        expect(paths.map((file) => readFileSync(file, 'utf8'))).toEqual(paths);
      } finally {
        removeTree(packageDir, { whenLocked: 'leave' });
      }
    })
  );
});

test('the unpartitioned run owns separate files and nightly keeps only its reports and evidence', () => {
  const packageDir = mkdtempSync(join(tmpdir(), 'release-all-'));
  const all = releaseArtifacts(packageDir, null);
  const first = releaseArtifacts(packageDir, { part: 0, parts: 3 });
  try {
    for (const dirs of [all, first]) {
      for (const dir of [dirs.distDir, dirs.reportDir, dirs.evidenceDir])
        putFile(join(dir, 'result'), dir);
    }
    removeReleaseArtifacts(all, true);
    for (const dir of [
      all.reportDir,
      all.evidenceDir,
      first.distDir,
      first.reportDir,
      first.evidenceDir,
    ])
      expect(readFileSync(join(dir, 'result'), 'utf8')).toBe(dir);
    expect(() => readFileSync(join(all.distDir, 'result'))).toThrow('ENOENT');
  } finally {
    removeTree(packageDir, { whenLocked: 'leave' });
  }
});

test('private public inputs preserve static files and regenerate SQLite assets', () => {
  const packageDir = mkdtempSync(join(tmpdir(), 'release-public-'));
  const dirs = releaseArtifacts(packageDir, { part: 0, parts: 3 });
  const staticFiles = ['favicon.ico', 'icons/app.svg', 'generated/other.json'];
  const generated = [
    'sql-workers/db-host-shared-worker.js',
    'generated/sqlite-wasm/sqlite3.wasm',
  ];
  try {
    for (const file of [...staticFiles, ...generated])
      putFile(join(packageDir, 'public', file), file);
    putFile(join(dirs.publicDir, 'stale'), 'previous run');
    prepareReleasePublic(packageDir, dirs);
    for (const file of staticFiles)
      expect(readFileSync(join(dirs.publicDir, file), 'utf8')).toBe(file);
    for (const file of [...generated, 'stale'])
      expect(() => readFileSync(join(dirs.publicDir, file))).toThrow('ENOENT');
  } finally {
    removeTree(packageDir, { whenLocked: 'leave' });
  }
});

test('Turbo owns exactly each release task’s report and browser evidence roots', () => {
  const packageDir = resolve(import.meta.dir, '..');
  const config = JSON.parse(
    readFileSync(join(packageDir, 'turbo.json'), 'utf8')
  ) as {
    readonly tasks: Readonly<
      Record<string, { readonly outputs: readonly string[] }>
    >;
  };
  for (const part of [null, 0, 1, 2]) {
    const dirs = releaseArtifacts(
      packageDir,
      part === null ? null : { part, parts: 3 }
    );
    const task = `test:release-journeys${part === null ? '' : `:${part}`}`;
    expect(config.tasks[task]?.outputs).toEqual(
      [dirs.reportDir, dirs.evidenceDir].map(
        (dir) => `${slashPath(relative(packageDir, dir))}/**`
      )
    );
  }
});
