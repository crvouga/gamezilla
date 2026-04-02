import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from './ci-platform';

export interface RunOpts {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Human-readable label shown in failure output (e.g. "S3 sync web-app"). */
  label?: string;
}

export function run(
  platform: CiPlatform,
  cmd: string,
  args: string[],
  opts?: RunOpts
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

  const fullCmd = `${cmd} ${args.join(' ')}`;
  const label = opts?.label ?? fullCmd;
  const t0 = performance.now();

  const base = {
    env: opts?.env ?? process.env,
    stdout: 'inherit' as const,
    stderr: 'inherit' as const,
    stdin: 'inherit' as const,
  };
  const spawnOpts = opts?.cwd !== undefined ? { ...base, cwd: opts.cwd } : base;
  const r = Bun.spawnSync([cmd, ...args], spawnOpts);
  const elapsed = fmtMs(performance.now() - t0);

  assert.ok(
    r.exitCode !== null && r.exitCode !== undefined,
    `run: Bun.spawnSync returned no exitCode for: ${fullCmd}`
  );
  if (r.exitCode !== 0) {
    platform.error(
      [
        `=== FAILED: ${label} ===`,
        `Command:  ${fullCmd}`,
        `Exit:     ${r.exitCode}`,
        `Duration: ${elapsed}`,
        opts?.cwd ? `Cwd:      ${opts.cwd}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
    assert.fail(
      `run: "${label}" exited ${r.exitCode} — crash, do not continue`
    );
  }
  assert.equals(r.exitCode, 0, 'run: expected exit code 0');
}

function fmtMs(ms: number): string {
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  return `${(ms / 1_000).toFixed(1)}s`;
}
