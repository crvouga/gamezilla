// @io-wall-ok — prepares the native broker distribution for its process runner.
import { cpSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

export type EmqxRuntime = {
  readonly bin: string;
  dispose(): void;
};

export function prepareEmqxRuntime(bin: string): EmqxRuntime {
  const resolved = realpathSync(bin);
  const root = dirname(dirname(resolved));
  if (!/\s/.test(root)) return { bin: resolved, dispose() {} };
  const temporary = realpathSync(tmpdir());
  const parent = /\s/.test(temporary) ? realpathSync('/tmp') : temporary;
  if (/\s/.test(parent))
    throw new Error('EMQX needs a temporary runtime path without whitespace');
  const runtime = mkdtempSync(join(parent, 'emqx-runtime-'));
  try {
    cpSync(root, runtime, {
      recursive: true,
      verbatimSymlinks: true,
      filter: (source) => {
        const path = relative(root, source);
        return path !== 'data' && path !== 'log';
      },
    });
  } catch (error) {
    rmSync(runtime, { recursive: true, force: true });
    throw error;
  }
  return {
    bin: join(runtime, relative(root, resolved)),
    dispose() {
      rmSync(runtime, { recursive: true, force: true });
    },
  };
}
