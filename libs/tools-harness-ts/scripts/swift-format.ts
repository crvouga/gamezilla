#!/usr/bin/env bun
// @io-wall-ok — Swift formatter entry: `bun run fmt:swift` writes, each package's `lint` checks.
/**
 * Swift's one formatter and linter is `swift format`, which ships with the
 * pinned toolchain (`native-toolchain.ts`), in its default style. A Swift
 * package's `lint` runs `swiftFormatOk` over its own files; `bun run fmt:swift`
 * (`//#fmt:swift`) rewrites every tracked Swift file, and needs no toolchain
 * when there is none.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import {
  resolveSwift,
  ToolchainError,
  withToolchain,
} from './native-toolchain';
import { spawnInherit } from './swift-task';

const REPO_ROOT = join(import.meta.dirname, '../../..');

/** `swift format lint --strict` over repo-relative `paths`. */
export async function swiftFormatOk(
  pkg: string,
  paths: readonly string[]
): Promise<boolean> {
  if (paths.length === 0) return true;
  try {
    const swift = resolveSwift();
    const ok =
      (await spawnInherit(
        swift.command,
        [
          ...swift.prefix,
          'format',
          'lint',
          '--strict',
          '--parallel',
          ...paths.map((path) => join(REPO_ROOT, path)),
        ],
        swift.env
      )) === 0;
    if (!ok)
      console.error(
        `${pkg}: Swift is formatted by \`swift format\` — run \`bun run fmt:swift\``
      );
    return ok;
  } catch (error) {
    if (!(error instanceof ToolchainError)) throw error;
    console.error(`${pkg}: swift format: ${error.message}`);
    return false;
  }
}

function trackedSwift(): readonly string[] {
  const listed = spawnSync(
    'git',
    [
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      '*.swift',
    ],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }
  );
  return listed.stdout.split('\0').filter((path) => path.length > 0);
}

if (import.meta.main)
  await withToolchain('fmt:swift', async () => {
    const files = trackedSwift().map((path) => join(REPO_ROOT, path));
    if (files.length === 0) return 0;
    const swift = resolveSwift();
    return spawnInherit(
      swift.command,
      [
        ...swift.prefix,
        'format',
        'format',
        '--in-place',
        '--parallel',
        ...files,
      ],
      swift.env
    );
  });
