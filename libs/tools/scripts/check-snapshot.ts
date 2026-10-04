// @io-wall-ok — copy a check invocation's inputs into private scratch.
import { execFile, execFileSync } from 'node:child_process';
import {
  constants,
  cpSync,
  existsSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

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
      !['.cache', '.turbo', '.vite'].includes(path.split('/').at(-1)!),
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
  // Copy objects too: garbage collection in the caller cannot invalidate a run.
  await copyDependencyTree(common, target);
  for (const name of ['worktrees', 'hooks', 'logs'])
    rmSync(join(target, name), { recursive: true, force: true });
  await writeFile(
    join(target, 'HEAD'),
    `${git(source, ['rev-parse', 'HEAD'])}\n`
  );
  await cp(join(local, 'index'), join(target, 'index'));
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
    await rm(join(destination, cache), { recursive: true, force: true });
}

async function copyDependencies(
  source: string,
  destination: string
): Promise<void> {
  if (existsSync(join(source, 'bun.lock'))) {
    await promisify(execFile)(
      process.execPath,
      [
        'install',
        '--offline',
        '--frozen-lockfile',
        '--ignore-scripts',
        `--backend=${process.platform === 'darwin' ? 'clonefile' : 'copyfile'}`,
      ],
      { cwd: destination, maxBuffer: 4 * 1024 * 1024 }
    );
    return;
  }
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
export async function createCheckSnapshot(source: string): Promise<string> {
  const container = await mkdtemp(join(tmpdir(), 'check-run-'));
  const destination = join(container, 'workspace');
  await mkdir(destination);
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
    rebaseLinks(destination, source, destination);
    return destination;
  } catch (error) {
    await rm(container, { recursive: true, force: true });
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
          relative(dirname(path), resolve(destination, relative(source, link))),
          path
        );
      }
    } else if (entry.isDirectory() && entry.name !== '.git')
      rebaseLinks(path, source, destination);
  }
}
