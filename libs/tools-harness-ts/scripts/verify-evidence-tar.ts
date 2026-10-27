// @io-wall-ok — CI evidence archives through Bun.Archive, so no OS tar is involved.
/**
 * Packs, lists and extracts the `.tar.gz` archives Verify shards hand to
 * `verify:end`, in-process with `Bun.Archive`. The system `tar` differs by OS
 * (bsdtar on macOS and Windows' System32, GNU tar first on a Git Bash PATH)
 * and could not list the shards' archives on the Windows runner (Verify runs
 * 40596596039 and 40599165745), so every verdict read as missing.
 *
 * `verify-evidence-archive.ts` and `verify-evidence-pack.ts` run this with the
 * current Bun so their callers stay synchronous:
 *
 *   verify-evidence-tar.ts pack <archive> <root> <path>...
 *   verify-evidence-tar.ts list <archive>
 *   verify-evidence-tar.ts extract <archive> <root> <manifest of paths>
 *
 * Member names are the given `/`-separated paths relative to `root`.
 */
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';

/** Every file `path` names under `root`, a directory standing for the files under it. */
function memberFiles(root: string, path: string): string[] {
  const absolute = join(root, path);
  if (!statSync(absolute).isDirectory()) return [slashPath(path)];
  return readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      slashPath(
        join(path, join(entry.parentPath, entry.name).slice(absolute.length))
      )
    );
}

/**
 * The archive members of `paths`, read now: `Bun.Archive` writes an empty
 * entry for a lazy `Bun.file()`, so each member is its bytes.
 */
export function archiveMembers(
  root: string,
  paths: readonly string[]
): Record<string, Uint8Array> {
  const members: Record<string, Uint8Array> = {};
  for (const path of paths)
    for (const member of memberFiles(root, path))
      members[member] = readFileSync(join(root, member));
  return members;
}

export async function packArchive(
  archive: string,
  root: string,
  paths: readonly string[]
): Promise<void> {
  await Bun.Archive.write(archive, archiveMembers(root, paths), {
    compress: 'gzip',
  });
}

async function openArchive(archive: string): Promise<Map<string, File>> {
  return new Bun.Archive(await Bun.file(archive).bytes()).files();
}

export async function listArchive(archive: string): Promise<string[]> {
  return [...(await openArchive(archive)).keys()];
}

/** Writes the named members under `root`; a name the archive lacks is an error. */
export async function extractArchive(
  archive: string,
  root: string,
  paths: readonly string[]
): Promise<void> {
  const files = await openArchive(archive);
  for (const path of paths) {
    const file = files.get(path);
    if (file === undefined)
      throw new Error(`${path} is not in ${slashPath(archive)}`);
    const destination = join(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, await file.bytes());
  }
}

if (import.meta.main) {
  const [command, archive, ...rest] = process.argv.slice(2);
  if (command === 'pack' && archive && rest.length >= 1)
    await packArchive(archive, rest[0]!, rest.slice(1));
  else if (command === 'list' && archive && rest.length === 0)
    for (const name of await listArchive(archive)) console.log(name);
  else if (command === 'extract' && archive && rest.length === 2)
    await extractArchive(
      archive,
      rest[0]!,
      readFileSync(rest[1]!, 'utf8').split(/\r?\n/).filter(Boolean)
    );
  else
    throw new Error(
      'usage: verify-evidence-tar.ts pack <archive> <root> <path>... | list <archive> | extract <archive> <root> <manifest>'
    );
}
