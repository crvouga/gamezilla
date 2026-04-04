import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from './ci-platform';

export interface RunOpts {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  label?: string;
}

export function run(
  platform: CiPlatform,
  cmd: string,
  args: string[],
  opts?: RunOpts
): void {
  assert.ok(typeof cmd === 'string' && cmd.length > 0, 'run: cmd must be non-empty');
  assert.array(args, 'run: args must be an array');

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

  if (r.exitCode !== 0 && r.exitCode !== null) {
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
    assert.fail(`run: "${label}" exited ${r.exitCode} — crash, do not continue`);
  }

  if (r.exitCode === null) {
    platform.error(`=== KILLED: ${label} === (signal or unknown termination, ${elapsed})`);
    assert.fail(`run: "${label}" was killed by a signal — crash, do not continue`);
  }
}

export function runCapture(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv }
): string {
  const r = Bun.spawnSync([cmd, ...args], {
    env: opts?.env ?? process.env,
    stdout: 'pipe',
    stderr: 'pipe',
    ...(opts?.cwd ? { cwd: opts.cwd } : {}),
  });
  if (r.exitCode === null) {
    throw new Error(`${cmd} ${args.join(' ')} was killed by a signal`);
  }
  if (r.exitCode !== 0) {
    const stderr = r.stderr.toString().trim();
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.exitCode}: ${stderr}`);
  }
  return r.stdout.toString().trim();
}

function fmtMs(ms: number): string {
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  return `${(ms / 1_000).toFixed(1)}s`;
}
