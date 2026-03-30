import assert from 'node:assert/strict';
import { reportError } from './ci-platform';

export function run(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv }
): void {
  assert(
    typeof cmd === 'string' && cmd.length > 0,
    'run: cmd must be non-empty'
  );
  assert(Array.isArray(args));
  assert(
    args.every((a) => typeof a === 'string'),
    'run: args must be string[]'
  );
  assert(
    opts?.cwd === undefined || opts.cwd.length > 0,
    'run: cwd when set must be non-empty'
  );
  const base = {
    env: opts?.env ?? process.env,
    stdout: 'inherit' as const,
    stderr: 'inherit' as const,
    stdin: 'inherit' as const,
  };
  const spawnOpts = opts?.cwd !== undefined ? { ...base, cwd: opts.cwd } : base;
  const r = Bun.spawnSync([cmd, ...args], spawnOpts);
  assert(
    r.exitCode !== null && r.exitCode !== undefined,
    `run: Bun.spawnSync returned no exitCode for: ${cmd} ${args.join(' ')}`
  );
  if (r.exitCode !== 0) {
    reportError(`${cmd} ${args.join(' ')} failed (exit ${r.exitCode})`);
    assert.fail(
      `run: ${cmd} ${args.join(' ')} exited ${r.exitCode} — crash, do not continue`
    );
  }
  assert.strictEqual(r.exitCode, 0);
}
