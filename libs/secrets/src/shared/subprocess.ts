// @io-wall-ok
import { spawn, spawnSync } from 'node:child_process';
import { assert } from '@pkgs/assert';
import { cliClock } from './cli-io';
import { fmtMs } from './fmt';

export interface RunOpts {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly label?: string;
}

export interface SpawnResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function stringsFromSpawn(
  stdout: string | Buffer | null | undefined,
  stderr: string | Buffer | null | undefined
): { stdout: string; stderr: string } {
  return {
    stdout:
      typeof stdout === 'string'
        ? stdout
        : stdout !== undefined && stdout !== null
          ? stdout.toString()
          : '',
    stderr:
      typeof stderr === 'string'
        ? stderr
        : stderr !== undefined && stderr !== null
          ? stderr.toString()
          : '',
  };
}

function spawnSyncCaptured(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string }
): SpawnResult {
  const r = spawnSync(cmd, args, {
    env: opts?.env ?? process.env,
    cwd: opts?.cwd,
    encoding: 'utf8',
    input: opts?.input,
    stdio:
      opts?.input !== undefined
        ? ['pipe', 'pipe', 'pipe']
        : ['ignore', 'pipe', 'pipe'],
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

export function runSafe(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv }
): SpawnResult {
  return spawnSyncCaptured(cmd, args, opts);
}

export async function runAsync(
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
  const t0 = cliClock.now();

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(cmd, args, {
        env: opts?.env ?? process.env,
        cwd: opts?.cwd,
        stdio: ['ignore', 'inherit', 'inherit'],
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
    const elapsed = fmtMs(cliClock.now() - t0);
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
