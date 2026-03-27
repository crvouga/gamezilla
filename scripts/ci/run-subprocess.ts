import assert from 'node:assert/strict';
import { ghError } from './gh';

export function run(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv }
): void {
  assert(typeof cmd === 'string' && cmd.length > 0, 'run: cmd must be non-empty');
  assert(Array.isArray(args));
  assert(
    args.every((a) => typeof a === 'string'),
    'run: args must be string[]'
  );
  const base = {
    env: opts?.env ?? process.env,
    stdout: 'inherit' as const,
    stderr: 'inherit' as const,
    stdin: 'inherit' as const,
  };
  const spawnOpts =
    opts?.cwd !== undefined ? { ...base, cwd: opts.cwd } : base;
  assert(
    opts?.cwd === undefined || opts.cwd.length > 0,
    'run: cwd when set must be non-empty'
  );
  const r = Bun.spawnSync([cmd, ...args], spawnOpts);
  assert(r.exitCode !== null && r.exitCode !== undefined, 'run: spawn exitCode');
  if (r.exitCode !== 0) {
    ghError(`${cmd} ${args.join(' ')} failed (exit ${r.exitCode})`);
    process.exit(r.exitCode ?? 1);
  }
  assert.strictEqual(r.exitCode, 0);
}
