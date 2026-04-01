import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from './ci-platform';

export function run(
  platform: CiPlatform,
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv }
): void {
  assert.ok(
    typeof cmd === 'string' && cmd.length > 0,
    'run: cmd must be non-empty'
  );
  assert.array(args, 'run: args must be an array');
  assert.ok(
    args.every((a) => typeof a === 'string'),
    'run: args must be string[]'
  );
  assert.ok(
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
  assert.ok(
    r.exitCode !== null && r.exitCode !== undefined,
    `run: Bun.spawnSync returned no exitCode for: ${cmd} ${args.join(' ')}`
  );
  if (r.exitCode !== 0) {
    platform.error(`${cmd} ${args.join(' ')} failed (exit ${r.exitCode})`);
    assert.fail(
      `run: ${cmd} ${args.join(' ')} exited ${r.exitCode} — crash, do not continue`
    );
  }
  assert.equals(r.exitCode, 0, 'run: expected exit code 0');
}
