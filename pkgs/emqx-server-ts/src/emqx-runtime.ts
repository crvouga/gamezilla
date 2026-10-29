// @io-wall-ok — prepares the native broker distribution for its process runner.
import { cpSync, mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';

export type EmqxRuntime = {
  readonly bin: string;
  dispose(): void;
};

/**
 * A whitespace-free temporary directory: the host's, else `/tmp` on POSIX.
 * Windows has no `/tmp`, so a temporary path with spaces there is an error.
 */
export function whitespaceFreeTemporaryDirectory(
  platform: NodeJS.Platform = process.platform
): string {
  const temporary = realpathSync(tmpdir());
  const parent =
    /\s/.test(temporary) && platform !== 'win32'
      ? realpathSync('/tmp')
      : temporary;
  if (/\s/.test(parent))
    throw new Error('EMQX needs a temporary runtime path without whitespace');
  return parent;
}

export function prepareEmqxRuntime(bin: string): EmqxRuntime {
  const resolved = realpathSync(bin);
  const root = dirname(dirname(resolved));
  if (!/\s/.test(root)) return { bin: resolved, dispose() {} };
  const parent = whitespaceFreeTemporaryDirectory();
  const runtime = mkdtempSync(join(parent, 'emqx-runtime-'));
  try {
    cpSync(root, runtime, {
      recursive: true,
      verbatimSymlinks: true,
      filter: (source) => {
        const path = slashPath(relative(root, source));
        return path !== 'data' && path !== 'log';
      },
    });
  } catch (error) {
    removeTree(runtime, { whenLocked: 'leave' });
    throw error;
  }
  return {
    bin: join(runtime, slashPath(relative(root, resolved))),
    dispose() {
      removeTree(runtime, { whenLocked: 'leave' });
    },
  };
}
