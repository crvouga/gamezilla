// @io-wall-ok — select paths inside an immutable CI evidence archive.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function archiveEntries(archive: string): string[] {
  const listed = spawnSync('tar', ['-tf', archive], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (listed.status !== 0) throw new Error('Cannot list shard evidence');
  return listed.stdout.split('\n').filter(Boolean);
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
    mkdirSync(root, { recursive: true });
    const extracted = spawnSync('tar', [
      '-xf',
      archive,
      '-C',
      root,
      '--no-recursion',
      '-T',
      manifest,
    ]);
    if (extracted.status !== 0)
      throw new Error(
        `Cannot extract selected shard evidence: ${extracted.stderr.toString()}`
      );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
