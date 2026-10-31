// @io-wall-ok — release CLI preparation owns its generated feature stubs.
import { cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { writeFeatureStubs } from './health';
import { RELEASE_ENVIRONMENT } from './release-selection';

export function releaseArtifacts(
  packageDir: string,
  part: { readonly part: number; readonly parts: number } | null
) {
  const scope = part === null ? 'all' : `part-${part.part}-of-${part.parts}`;
  const scratchDir = join(packageDir, '.cache/release-journeys', scope);
  return {
    scratchDir,
    stubDir: join(scratchDir, 'stubs'),
    reportDir: join(packageDir, '.cache/release-report', scope),
    distDir: join(scratchDir, 'web'),
    publicDir: join(scratchDir, 'public'),
    viteCacheDir: join(scratchDir, 'vite'),
    evidenceDir: join(
      packageDir,
      '.cache/critical-journeys',
      `release-${scope}`
    ),
  };
}

/** Copy static inputs; this build emits its own SQLite assets afterward. */
export function prepareReleasePublic(
  packageDir: string,
  dirs: ReturnType<typeof releaseArtifacts>
): void {
  const source = join(packageDir, 'public');
  removeTree(dirs.publicDir);
  cpSync(source, dirs.publicDir, {
    recursive: true,
    filter: (path) =>
      path !== join(source, 'sql-workers') &&
      path !== join(source, 'generated/sqlite-wasm'),
  });
}

export function writeReleaseStubs(
  packageDir: string,
  specs: readonly string[],
  dirs: ReturnType<typeof releaseArtifacts>
): readonly string[] {
  removeTree(dirs.stubDir);
  mkdirSync(dirs.stubDir, { recursive: true });
  return writeFeatureStubs(
    RELEASE_ENVIRONMENT,
    specs,
    { ...dirs, timelineReports: true },
    join(packageDir, 'tests/steps/release-index.ts')
  );
}

/** A finished part removes only its own files; nightly retains its evidence. */
export function removeReleaseArtifacts(
  dirs: ReturnType<typeof releaseArtifacts>,
  keepReports: boolean
): void {
  const paths = keepReports
    ? [dirs.scratchDir]
    : [dirs.scratchDir, dirs.reportDir, dirs.evidenceDir];
  for (const path of paths) removeTree(path, { whenLocked: 'leave' });
}
