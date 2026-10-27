// @io-wall-ok — select paths inside an immutable CI evidence archive.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';

/**
 * `path` as tar names an archive: relative to the `cwd` tar runs in, with `/`
 * separators. GNU tar (Git Bash on Windows) reads `C:\…` as `host:path`, a
 * remote archive; a relative path means the same file to it and to bsdtar.
 */
export function tarPath(cwd: string, path: string): string {
  return relative(cwd, resolve(cwd, path)).split(sep).join('/');
}

export function archiveEntries(archive: string): string[] {
  const cwd = dirname(resolve(archive));
  const listed = spawnSync('tar', ['-tf', tarPath(cwd, archive)], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (listed.status !== 0) throw new Error('Cannot list shard evidence');
  return listed.stdout.split(/\r?\n/).filter(Boolean);
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
    const extracted = spawnSync(
      'tar',
      ['-xf', tarPath(root, archive), '--no-recursion', '-T', manifest],
      { cwd: root }
    );
    if (extracted.status !== 0)
      throw new Error(
        `Cannot extract selected shard evidence: ${extracted.stderr.toString()}`
      );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
