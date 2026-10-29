// @io-wall-ok — select paths inside an immutable CI evidence archive.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

/**
 * Runs `verify-evidence-tar.ts` with the current Bun, so an archive means the
 * same on every OS and no system `tar` is involved.
 */
export function evidenceTar(args: readonly string[], failure: string): string {
  const result = spawnSync(
    process.execPath,
    [join(import.meta.dirname, 'verify-evidence-tar.ts'), ...args],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  );
  if (result.status !== 0)
    throw new Error(`${failure}: ${result.stderr.trim()}`);
  return result.stdout;
}

export function archiveEntries(archive: string): string[] {
  return evidenceTar(['list', resolve(archive)], 'Cannot list shard evidence')
    .split(/\r?\n/)
    .filter(Boolean);
}

export function extractEvidence(
  archive: string,
  paths: readonly string[],
  root: string
): void {
  if (!paths.length) return;
  const directory = mkdtempSync(join(tmpdir(), 'evidence-paths-'));
  try {
    const manifest = join(directory, 'paths');
    writeFileSync(manifest, paths.join('\n') + '\n');
    evidenceTar(
      ['extract', resolve(archive), resolve(root), manifest],
      'Cannot extract selected shard evidence'
    );
  } finally {
    removeTree(directory, { whenLocked: 'leave' });
  }
}
