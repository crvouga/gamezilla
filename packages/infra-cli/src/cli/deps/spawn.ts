import { spawnSync } from 'node:child_process';

/** True if `bin` exists on PATH (cross-platform; uses `where` on Windows). */
export function whichSync(bin: string): boolean {
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'where' : 'which';
  const r = spawnSync(cmd, [bin], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  return r.status === 0 && !r.error;
}

export function captureVersion(bin: string, args: string[]): string | null {
  try {
    const r = spawnSync(bin, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    if (r.status !== 0 || r.error) return null;
    const out = (r.stdout ?? '').toString().trim();
    const match = out.match(/[\d]+\.[\d]+[\w.+-]*/);
    return match ? match[0] : out.split('\n')[0]!.trim();
  } catch {
    return null;
  }
}

export function spawnInstall(cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0 || r.error) {
    throw new Error(
      `${cmd} ${args.join(' ')} exited ${r.status ?? 'with error'}`
    );
  }
}

export function verifyRun(bin: string, args: string[]): void {
  const r = spawnSync(bin, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  if (r.status !== 0 || r.error) {
    const stderr = (r.stderr ?? '').toString().trim();
    const stdout = (r.stdout ?? '').toString().trim();
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    throw new Error(`${bin} ${args.join(' ')} exited ${r.status}`);
  }
}
