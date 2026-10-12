// @io-wall-ok — current spec outline and advisory Git provenance for standalone Atlas.
import { spawnSync } from 'node:child_process';
import { eachLimited } from '@crvouga/atlas/reports/completion-order';
import type { SpecEntry } from '@crvouga/atlas/reports/explorer-types';
import { specEntry } from '@crvouga/atlas/reports/spec-inventory';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import { readUtf8 } from '@pkgs/object-store-root-shared/helpers';

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

export async function workspaceOutline(root: string) {
  const store = createNodeFsObjectStore({
    rootDir: root,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const paths = await store.listKeys('specs/');
  const specs: SpecEntry[] = [];
  await eachLimited(paths, 16, async (path) => {
    specs.push(specEntry(path, (await readUtf8(store, path)) ?? ''));
  });
  specs.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const changedFiles = [
    git(root, ['diff', '--name-only', 'HEAD']),
    git(root, ['ls-files', '--others', '--exclude-standard']),
  ].flatMap((text) => text.split('\n').filter(Boolean));
  return {
    specs,
    changedFiles,
    sha: git(root, ['rev-parse', 'HEAD']) || null,
    readSpec: (path: string) => readUtf8(store, path),
  };
}
