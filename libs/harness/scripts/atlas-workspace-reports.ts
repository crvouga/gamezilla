// @io-wall-ok — local reports composition reads committed Git content, never secrets in the browser.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import type { WorkspaceReports } from '@crvouga/atlas/reports/explorer-types';
import { readParts } from '@crvouga/atlas/reports/report-parts';
import { specEntry } from '@crvouga/atlas/reports/spec-inventory';
import { readCommittedSpecs } from '@libs/harness/committed-specs';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';

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
  if (result.status !== 0) throw new Error('Cannot read the checkout version');
  return result.stdout;
}

let cached: {
  repoRoot: string;
  sha: string;
  documents: readonly { path: string; content: string }[];
} | null = null;

export async function workspaceReports(
  repoRoot: string
): Promise<WorkspaceReports> {
  const sha = git(repoRoot, ['rev-parse', 'HEAD']).toString().trim();
  if (cached?.sha !== sha || cached.repoRoot !== repoRoot) {
    cached = { repoRoot, sha, documents: readCommittedSpecs(repoRoot, sha) };
  }
  const store = new ObjectStoreImplInMemory();
  for (const document of cached.documents)
    await writeUtf8(store, document.path, document.content);
  const local = createNodeFsObjectStore({
    rootDir: join(repoRoot, '.cache/local-reports'),
    fs: wallNodeFs(),
    layout: 'tree',
  });
  return {
    version: {
      sha,
      branch: git(repoRoot, ['branch', '--show-current']).toString().trim(),
      dirty:
        git(repoRoot, ['status', '--porcelain', '--untracked-files=no'])
          .length > 0,
    },
    inventory: {
      sha,
      entries: cached.documents.map((doc) => specEntry(doc.path, doc.content)),
    },
    parts: await readParts(local, sha),
    readSpec: (path) => readUtf8(store, path),
  };
}
