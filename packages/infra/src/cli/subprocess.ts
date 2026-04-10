import { spawn, spawnSync } from 'node:child_process';
import { assert } from '@gamezilla/shared/assert';
import { fmtMs } from './lib/fmt';
import type { CiPlatform } from './platform/platform';

export interface RunOpts {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  label?: string;
}

function stringsFromSpawn(
  stdout: string | Buffer | null | undefined,
  stderr: string | Buffer | null | undefined
): { stdout: string; stderr: string } {
  return {
    stdout:
      typeof stdout === 'string'
        ? stdout
        : stdout != null
          ? stdout.toString()
          : '',
    stderr:
      typeof stderr === 'string'
        ? stderr
        : stderr != null
          ? stderr.toString()
          : '',
  };
}

function spawnSyncCaptured(
  cmd: string,
  args: string[],
  opts?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    input?: string;
  }
): SpawnResult {
  const r = spawnSync(cmd, args, {
    env: opts?.env ?? process.env,
    cwd: opts?.cwd,
    encoding: 'utf8',
    input: opts?.input,
    stdio: opts?.input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
  });

  if (r.error) {
    return {
      exitCode: r.status ?? 127,
      stdout: '',
      stderr: r.error.message,
    };
  }

  const { stdout, stderr } = stringsFromSpawn(r.stdout, r.stderr);
  return {
    exitCode: r.status === null ? -1 : r.status,
    stdout,
    stderr,
  };
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

  const r = spawnSync(cmd, args, {
    env: opts?.env ?? process.env,
    cwd: opts?.cwd,
    stdio: 'inherit',
  });
  const elapsed = fmtMs(performance.now() - t0);

  if (r.error) {
    platform.error(
      [
        `=== FAILED: ${label} ===`,
        `Command:  ${fullCmd}`,
        `Error:    ${r.error.message}`,
        `Duration: ${elapsed}`,
        opts?.cwd ? `Cwd:      ${opts.cwd}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
    assert.fail(
      `run: "${label}" — ${r.error.message} (is ${cmd} installed and on PATH?)`
    );
  }

  if (r.status !== 0 && r.status !== null) {
    platform.error(
      [
        `=== FAILED: ${label} ===`,
        `Command:  ${fullCmd}`,
        `Exit:     ${r.status}`,
        `Duration: ${elapsed}`,
        opts?.cwd ? `Cwd:      ${opts.cwd}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
    assert.fail(
      `run: "${label}" exited ${r.status} — crash, do not continue`
    );
  }

  if (r.signal) {
    platform.error(
      `=== KILLED: ${label} === (signal ${r.signal}, ${elapsed})`
    );
    assert.fail(
      `run: "${label}" was killed by a signal — crash, do not continue`
    );
  }
}

/**
 * Run a command, capturing all output. On success the output is discarded;
 * on failure it is printed to stderr before throwing.
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
  const r = spawnSync(cmd, args, {
    env: opts?.env ?? process.env,
    cwd: opts?.cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (r.error) {
    assert.fail(`runQuiet: "${label}" — ${r.error.message}`);
  }

  if (r.status !== 0 && r.status !== null) {
    const { stdout, stderr } = stringsFromSpawn(r.stdout, r.stderr);
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());
    assert.fail(`runQuiet: "${label}" exited ${r.status}`);
  }
  if (r.signal) {
    assert.fail(`runQuiet: "${label}" was killed by signal ${r.signal}`);
  }
}

export function runCapture(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string }
): string {
  const r = spawnSyncCaptured(cmd, args, opts);
  if (r.exitCode !== 0) {
    const stderr = r.stderr.trim();
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.exitCode}: ${stderr}`);
  }
  return r.stdout.trim();
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
  return spawnSyncCaptured(cmd, args, opts);
}

export function runLocal(
  cmd: string,
  args: string[],
  opts?: { cwd?: string }
): void {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    env: process.env,
    cwd: opts?.cwd,
    stdio: 'inherit',
  });
  if (r.error) {
    throw new Error(`${cmd} ${args.join(' ')} — ${r.error.message}`);
  }
  if (r.status !== 0 && r.status !== null) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}`);
  }
  if (r.signal) {
    throw new Error(`${cmd} ${args.join(' ')} killed by signal ${r.signal}`);
  }
}

// ── Async variants (non-blocking, safe for parallel DAG execution) ───

export async function runAsync(
  _platform: CiPlatform,
  cmd: string,
  args: string[],
  opts?: RunOpts
): Promise<void> {
  assert.ok(
    typeof cmd === 'string' && cmd.length > 0,
    'runAsync: cmd must be non-empty'
  );
  assert.array(args, 'runAsync: args must be an array');

  const fullCmd = `${cmd} ${args.join(' ')}`;
  const label = opts?.label ?? fullCmd;
  const t0 = performance.now();

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(cmd, args, {
        env: opts?.env ?? process.env,
        cwd: opts?.cwd,
        stdio: 'inherit',
      });
      child.on('error', reject);
      child.on('close', (code, signal) => {
        if (signal) {
          reject(new Error(`${label} killed by signal ${signal}`));
          return;
        }
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`${label} failed (exit ${code})`));
      });
    });
  } catch (e: unknown) {
    const elapsed = fmtMs(performance.now() - t0);
    const err = e instanceof Error ? e.message : String(e);
    const detail = [
      `Command:  ${fullCmd}`,
      `Error:    ${err}`,
      `Duration: ${elapsed}`,
      opts?.cwd ? `Cwd:      ${opts.cwd}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    throw new Error(`${label} failed\n${detail}`);
  }
}

export async function runCaptureAsync(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts?.cwd,
      env: opts?.env ?? process.env,
      stdio:
        opts?.input !== undefined
          ? ['pipe', 'pipe', 'pipe']
          : ['ignore', 'pipe', 'pipe'],
    });

    if (opts?.input !== undefined && child.stdin) {
      child.stdin.write(opts.input, 'utf8');
      child.stdin.end();
    }

    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (c: string | Buffer) => {
      stdout += typeof c === 'string' ? c : c.toString('utf8');
    });
    child.stderr?.on('data', (c: string | Buffer) => {
      stderr += typeof c === 'string' ? c : c.toString('utf8');
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      const msg =
        err.code === 'ENOENT'
          ? `Executable not found in PATH: ${cmd}`
          : err.message;
      reject(new Error(`${cmd} ${args.join(' ')}: ${msg}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      const detail = stderr.trim() || `exit ${code}`;
      reject(new Error(`${cmd} ${args.join(' ')}: ${detail}`));
    });
  });
}
