import { assert } from '@gamezilla/shared/assert';
import { fmtMs } from './lib/fmt';
import type { CiPlatform } from './platform/platform';

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
  assert.ok(
    typeof cmd === 'string' && cmd.length > 0,
    'run: cmd must be non-empty'
  );
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
    assert.fail(
      `run: "${label}" exited ${r.exitCode} — crash, do not continue`
    );
  }

  if (r.exitCode === null) {
    platform.error(
      `=== KILLED: ${label} === (signal or unknown termination, ${elapsed})`
    );
    assert.fail(
      `run: "${label}" was killed by a signal — crash, do not continue`
    );
  }
}

/**
 * Run a command, capturing all output. On success the output is discarded;
 * on failure it is printed to stderr before throwing.  Useful for commands
 * (like `terraform apply -target`) that emit noisy but harmless warnings.
 */
export function runQuiet(
  cmd: string,
  args: string[],
  opts?: RunOpts
): void {
  assert.ok(
    typeof cmd === 'string' && cmd.length > 0,
    'runQuiet: cmd must be non-empty'
  );
  assert.array(args, 'runQuiet: args must be an array');

  const label = opts?.label ?? `${cmd} ${args.join(' ')}`;
  const r = Bun.spawnSync([cmd, ...args], {
    env: opts?.env ?? process.env,
    stdout: 'pipe',
    stderr: 'pipe',
    ...(opts?.cwd ? { cwd: opts.cwd } : {}),
  });

  if (r.exitCode !== 0 && r.exitCode !== null) {
    const stderr = r.stderr.toString().trim();
    const stdout = r.stdout.toString().trim();
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    assert.fail(`runQuiet: "${label}" exited ${r.exitCode}`);
  }
  if (r.exitCode === null) {
    assert.fail(`runQuiet: "${label}" was killed by a signal`);
  }
}

export function runCapture(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string }
): string {
  const r = Bun.spawnSync([cmd, ...args], {
    env: opts?.env ?? process.env,
    stdout: 'pipe',
    stderr: 'pipe',
    ...(opts?.cwd ? { cwd: opts.cwd } : {}),
    ...(opts?.input !== undefined
      ? { stdin: Buffer.from(opts.input) }
      : {}),
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

export interface SpawnResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export function runSafe(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv }
): SpawnResult {
  const r = Bun.spawnSync([cmd, ...args], {
    env: opts?.env ?? process.env,
    stdout: 'pipe',
    stderr: 'pipe',
    ...(opts?.cwd ? { cwd: opts.cwd } : {}),
  });
  return {
    exitCode: r.exitCode,
    stdout: r.stdout.toString(),
    stderr: r.stderr.toString(),
  };
}

export function runLocal(
  cmd: string,
  args: string[],
  opts?: { cwd?: string }
): void {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const base = {
    env: process.env,
    stdout: 'inherit' as const,
    stderr: 'inherit' as const,
    stdin: 'inherit' as const,
  };
  const spawnOpts = opts?.cwd !== undefined ? { ...base, cwd: opts.cwd } : base;
  const r = Bun.spawnSync([cmd, ...args], spawnOpts);
  if (r.exitCode !== 0 && r.exitCode !== null) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.exitCode}`);
  }
  if (r.exitCode === null) {
    throw new Error(`${cmd} ${args.join(' ')} killed by signal`);
  }
}

// ── Async variants (non-blocking, safe for parallel DAG execution) ───

export async function runAsync(
  platform: CiPlatform,
  cmd: string,
  args: string[],
  opts?: RunOpts,
): Promise<void> {
  assert.ok(
    typeof cmd === 'string' && cmd.length > 0,
    'runAsync: cmd must be non-empty',
  );
  assert.array(args, 'runAsync: args must be an array');

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
  const proc = Bun.spawn([cmd, ...args], spawnOpts);
  const exitCode = await proc.exited;
  const elapsed = fmtMs(performance.now() - t0);

  if (exitCode !== 0) {
    const detail = [
      `Command:  ${fullCmd}`,
      `Exit:     ${exitCode}`,
      `Duration: ${elapsed}`,
      opts?.cwd ? `Cwd:      ${opts.cwd}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    throw new Error(`${label} failed (exit ${exitCode})\n${detail}`);
  }
}

export async function runCaptureAsync(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string },
): Promise<string> {
  const proc = Bun.spawn([cmd, ...args], {
    env: opts?.env ?? process.env,
    stdout: 'pipe',
    stderr: 'pipe',
    ...(opts?.cwd ? { cwd: opts.cwd } : {}),
    ...(opts?.input !== undefined
      ? { stdin: new Blob([opts.input]) }
      : {}),
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(
      `${cmd} ${args.join(' ')} exited ${exitCode}: ${stderr.trim()}`,
    );
  }
  return stdout.trim();
}
