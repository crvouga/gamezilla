// @io-wall-ok — spools process output to an owned temporary file and reads bounded chunks.
import { execFileSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import {
  projectTurboDryRun,
  type TurboDryRun,
} from './turbo-dry-run-projection';

/** A dry run can exceed the child-process capture bound without retaining its inputs in RAM. */
export function captureTurboDryRun(
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): TurboDryRun & { readonly outputBytes: number } {
  return captureDryRun('turbo', [...args, '--dry=json'], { cwd, env });
}

/** The command owns stdout; stderr remains visible, and every exit path removes the spool. */
export function captureDryRun(
  command: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly env: NodeJS.ProcessEnv;
    readonly temporaryRoot?: string;
  }
): TurboDryRun & { readonly outputBytes: number } {
  const directory = mkdtempSync(
    join(options.temporaryRoot ?? tmpdir(), 'turbo-dry-run-')
  );
  const path = join(directory, 'plan.json');
  try {
    const output = openSync(path, 'w');
    try {
      execFileSync(command, [...args], {
        cwd: options.cwd,
        env: options.env,
        stdio: ['ignore', output, 'inherit'],
      });
    } finally {
      closeSync(output);
    }
    return {
      ...projectTurboDryRun(fileChunks(path)),
      outputBytes: statSync(path).size,
    };
  } finally {
    removeTree(directory, { whenLocked: 'leave' });
  }
}

/** StringDecoder preserves UTF-8 characters split across the fixed-size reads. */
function* fileChunks(path: string): Generator<string> {
  const input = openSync(path, 'r');
  const buffer = Buffer.alloc(64 * 1024);
  const decoder = new StringDecoder('utf8');
  try {
    for (;;) {
      const size = readSync(input, buffer);
      if (size === 0) break;
      yield decoder.write(buffer.subarray(0, size));
    }
    yield decoder.end();
  } finally {
    closeSync(input);
  }
}
