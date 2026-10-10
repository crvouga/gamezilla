// @io-wall-ok — read specification bytes at an exact committed revision.
import { spawnSync } from 'node:child_process';
import { isCommitSha } from '@crvouga/atlas-reports/keys';
import { isSpecPath } from '@crvouga/atlas-reports/spec-inventory';

function git(
  repoRoot: string,
  args: readonly string[],
  input?: string
): Buffer {
  const result = spawnSync('git', [...args], {
    cwd: repoRoot,
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error('Cannot read committed specifications');
  return result.stdout;
}

export function readCommittedSpecs(repoRoot: string, sha: string) {
  if (!isCommitSha(sha)) throw new Error('Invalid commit');
  const paths = git(repoRoot, [
    'ls-tree',
    '-rz',
    '--name-only',
    sha,
    '--',
    'specs',
  ])
    .toString()
    .split('\0')
    .filter(Boolean);
  if (paths.some((path) => !isSpecPath(path)))
    throw new Error('Invalid committed spec path');
  if (paths.length === 0) return [];
  return committedDocuments(
    paths,
    git(
      repoRoot,
      ['cat-file', '--batch'],
      `${paths.map((path) => `${sha}:${path}`).join('\n')}\n`
    )
  );
}

/** Parse Git's size-delimited batch output; document newlines are preserved. */
export function committedDocuments(
  paths: readonly string[],
  bytes: Uint8Array
): readonly { path: string; content: string }[] {
  const data = Buffer.from(bytes);
  let offset = 0;
  return paths.map((path) => {
    const end = data.indexOf(10, offset);
    const header = data.subarray(offset, end).toString();
    const size = Number(header.split(' ').at(-1));
    if (
      end < 0 ||
      !/^[0-9a-f]+ blob \d+$/.test(header) ||
      !Number.isSafeInteger(size) ||
      end + size + 2 > data.length
    )
      throw new Error('Invalid committed spec content');
    const content = data.subarray(end + 1, end + 1 + size).toString('utf8');
    offset = end + size + 2;
    return { path, content };
  });
}
