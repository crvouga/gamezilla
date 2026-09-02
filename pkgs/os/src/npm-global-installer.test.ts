import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import {
  npmGlobalRenameLeftovers,
  pruneNpmGlobalRenameLeftovers,
} from './npm-global-installer';
import { missingOsFs, type OsFs } from './os-fs';

function memoryOsFs(opts: {
  readonly root: string;
  readonly entries: readonly string[];
}): { readonly osFs: OsFs; readonly removed: string[] } {
  const removed: string[] = [];
  const osFs: OsFs = {
    ...missingOsFs,
    pathExists: (absolutePath) => absolutePath === opts.root,
    readdirSync: (absolutePath) => {
      if (absolutePath !== opts.root) {
        throw new Error(`unexpected readdir: ${absolutePath}`);
      }
      return [...opts.entries];
    },
    rmrfSync: (absolutePath) => {
      removed.push(absolutePath);
    },
  };
  return { osFs, removed };
}

describe('npmGlobalRenameLeftovers', () => {
  it('matches npm rename dest dirs and ignores the live package', () => {
    expect(
      npmGlobalRenameLeftovers(
        ['eas-cli', '.eas-cli-L8G7nhIU', '.eas-cli', 'wrangler'],
        'eas-cli'
      )
    ).toEqual(['.eas-cli-L8G7nhIU']);
  });
});

describe('pruneNpmGlobalRenameLeftovers', () => {
  it('removes leftover rename dirs under the global node_modules root', () => {
    const root = '/npm/lib/node_modules';
    const { osFs, removed } = memoryOsFs({
      root,
      entries: ['eas-cli', '.eas-cli-L8G7nhIU', 'wrangler'],
    });
    expect(
      pruneNpmGlobalRenameLeftovers({
        osFs,
        nodeModulesRoot: root,
        pkg: 'eas-cli',
      })
    ).toEqual(['.eas-cli-L8G7nhIU']);
    expect(removed).toEqual([join(root, '.eas-cli-L8G7nhIU')]);
  });

  it('is a no-op when the root is missing', () => {
    expect(
      pruneNpmGlobalRenameLeftovers({
        osFs: missingOsFs,
        nodeModulesRoot: '/missing',
        pkg: 'eas-cli',
      })
    ).toEqual([]);
  });
});
