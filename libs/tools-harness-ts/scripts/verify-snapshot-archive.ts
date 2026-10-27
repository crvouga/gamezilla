// @io-wall-ok — retain compressed diagnostics, release a completed run's private files.
import { execFile } from 'node:child_process';
import { renameSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';

/** Keep inputs, logs and reports, but never archive disposable dependency/cache copies. */
export async function archiveVerifySnapshot(root: string): Promise<string> {
  const container = dirname(root);
  const archive = join(container, 'diagnostics.tar.gz');
  const pending = join(container, 'diagnostics.pending.tar.gz');
  // Relative names: GNU tar (Git Bash on Windows) misreads `C:\…` paths.
  await promisify(execFile)(
    'tar',
    [
      '--use-compress-program=gzip -1',
      '-cf',
      basename(pending),
      '--exclude=node_modules',
      '--exclude=.git',
      '--exclude=.turbo/cache',
      '--exclude=.cache/ui-quality-model',
      '--exclude=.cache/secrets',
      '-C',
      basename(root),
      '.',
    ],
    { cwd: container }
  );
  renameSync(pending, archive);
  rmSync(root, { recursive: true, force: true });
  rmSync(join(container, 'tmp'), { recursive: true, force: true });
  return archive;
}
