// @io-wall-ok — copy a verification invocation's inputs into private scratch.
import { execFile, execFileSync } from 'node:child_process';
import {
  constants,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { lastSegment, slashPath } from '@pkgs/os-shared-ts/slash-path';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function copyInput(source: string, destination: string): void {
  if (!existsSync(source)) return; // A tracked deletion is part of the snapshot.
  cpSync(source, destination, {
    recursive: true,
    verbatimSymlinks: true,
    mode: constants.COPYFILE_FICLONE,
    filter: (path) =>
      !['.cache', '.git', '.turbo', '.vite'].includes(lastSegment(path)),
  });
}

/** The installed visual model is a prepared dependency, not cached evidence. */
function copyPreparedModel(source: string, destination: string): void {
  const path = '.cache/ui-quality-model';
  if (!existsSync(join(source, path))) return;
  cpSync(join(source, path), join(destination, path), {
    recursive: true,
    dereference: true,
    mode: constants.COPYFILE_FICLONE,
  });
}

/** Private Git metadata, including the original index; never registers a worktree. */
async function copyGit(source: string, destination: string): Promise<void> {
  const common = git(source, [
    'rev-parse',
    '--path-format=absolute',
    '--git-common-dir',
  ]);
  const local = git(source, ['rev-parse', '--absolute-git-dir']);
  const target = join(destination, '.git');
  // Pin references before copying objects: commits during the copy belong to
  // the next run, and may not exist in this run's copied object database.
  const head = git(source, ['rev-parse', 'HEAD']);
  const refs = git(source, ['show-ref']);
  const index = readFileSync(join(local, 'index'));
  // Copy objects too: garbage collection in the caller cannot invalidate a run.
  await copyDependencyTree(common, target);
  for (const name of ['worktrees', 'hooks', 'logs', 'refs'])
    removeTree(join(target, name));
  await writeFile(join(target, 'HEAD'), `${head}\n`);
  await writeFile(join(target, 'packed-refs'), `${refs}\n`);
  await mkdir(join(target, 'refs'));
  await writeFile(join(target, 'index'), index);
  // A linked checkout's config must not redirect commands back to the source.
  await writeFile(
    join(target, 'config'),
    '[core]\n\trepositoryformatversion = 0\n\tbare = false\n'
  );
}

async function copyDependencyTree(
  source: string,
  destination: string
): Promise<void> {
  if (!existsSync(source)) return;
  // Native recursive copies avoid one JS/filesystem round-trip per dependency file.
  await mkdir(dirname(destination), { recursive: true });
  const flags =
    process.platform === 'darwin' ? ['-cR'] : ['-a', '--reflink=auto'];
  await promisify(execFile)('cp', [...flags, source, destination]);
  for (const cache of ['.cache', '.turbo', '.vite'])
    removeTree(join(destination, cache));
}

async function copyDependencies(
  source: string,
  destination: string
): Promise<void> {
  await copyDependencyTree(
    join(source, 'node_modules'),
    join(destination, 'node_modules')
  );
  for (const tier of ['apps', 'libs', 'pkgs']) {
    if (!existsSync(join(source, tier))) continue;
    for (const entry of await readdir(join(source, tier), {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) continue;
      const path = join(tier, entry.name, 'node_modules');
      await copyDependencyTree(join(source, path), join(destination, path));
    }
  }
}

/** Preserve dirty/untracked inputs and installed dependencies, never another run's outputs. */
export async function createVerifySnapshot(source: string): Promise<string> {
  const container = mkdtempSync(join(tmpdir(), 'verify-run-'));
  const destination = join(container, 'workspace');
  mkdirSync(destination);
  try {
    const paths = git(source, [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '-z',
    ])
      .split('\0')
      .filter(Boolean);
    for (const path of new Set(paths))
      copyInput(join(source, path), join(destination, path));
    await copyGit(source, destination);
    await copyDependencies(source, destination);
    copyPreparedModel(source, destination);
    rebaseLinks(destination, source, destination);
    return destination;
  } catch (error) {
    removeTree(container, { whenLocked: 'leave' });
    throw error;
  }
}

/** Absolute workspace links must not execute source-checkout modules. */
function rebaseLinks(
  directory: string,
  source: string,
  destination: string
): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      const link = readlinkSync(path);
      if (link.startsWith(`${source}/`)) {
        rmSync(path);
        symlinkSync(
          slashPath(
            relative(
              dirname(path),
              resolve(destination, relative(source, link))
            )
          ),
          path
        );
      }
    } else if (entry.isDirectory() && entry.name !== '.git')
      rebaseLinks(path, source, destination);
  }
}
