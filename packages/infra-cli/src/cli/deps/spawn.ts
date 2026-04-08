export function whichSync(bin: string): boolean {
  const r = Bun.spawnSync(['which', bin], { stdout: 'pipe', stderr: 'pipe' });
  return r.exitCode === 0;
}

export function captureVersion(bin: string, args: string[]): string | null {
  try {
    const r = Bun.spawnSync([bin, ...args], { stdout: 'pipe', stderr: 'pipe' });
    if (r.exitCode !== 0) return null;
    const out = r.stdout.toString().trim();
    const match = out.match(/[\d]+\.[\d]+[\w.+-]*/);
    return match ? match[0] : out.split('\n')[0]!.trim();
  } catch {
    return null;
  }
}

export function spawnInstall(cmd: string, args: string[]): void {
  const r = Bun.spawnSync([cmd, ...args], {
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
    env: process.env,
  });
  if (r.exitCode !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.exitCode}`);
  }
}

export function verifyRun(bin: string, args: string[]): void {
  const r = Bun.spawnSync([bin, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  });
  if (r.exitCode !== 0) {
    const stderr = r.stderr.toString().trim();
    const stdout = r.stdout.toString().trim();
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    throw new Error(`${bin} ${args.join(' ')} exited ${r.exitCode}`);
  }
}
