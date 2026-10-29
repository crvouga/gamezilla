// @io-wall-ok — OS process-environment adapter returns only ownership stamps.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';

export type OwnerStamp = {
  root: string;
  boot: string | null;
  cwd: string | null;
};
function macProbe(): string {
  const source = join(import.meta.dirname, 'dev-owner-probe.c');
  const dir = join(import.meta.dirname, '../../../.cache/dev-owner');
  const binary = join(dir, 'probe-darwin');
  mkdirSync(dir, { recursive: true });
  if (
    !existsSync(binary) ||
    statSync(binary).mtimeMs < statSync(source).mtimeMs
  ) {
    const temporary = `${binary}.${process.pid}`;
    execFileSync('cc', ['-O2', '-Wall', '-Werror', source, '-o', temporary], {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 30000,
    });
    renameSync(temporary, binary);
  }
  return binary;
}
export function ownerEnvironments(pids: number[]): Map<number, OwnerStamp> {
  const stamps = new Map<number, OwnerStamp>();
  if (!pids.length) return stamps;
  if (process.platform === 'darwin') {
    let output: string;
    try {
      output = execFileSync(macProbe(), pids.map(String), {
        encoding: 'utf8',
        timeout: 15000,
        maxBuffer: 8 * 1024 * 1024,
      });
    } catch {
      throw new Error('Ownership stamp probe failed; refusing cleanup');
    }
    for (const line of output.trim().split('\n')) {
      const [pid, root, boot, cwd] = line.split('\t');
      if (root)
        stamps.set(Number(pid), { root, boot: boot || null, cwd: cwd || null });
    }
    return stamps;
  }
  for (const pid of pids) {
    try {
      const env = readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0');
      const root = env
        .find((entry) => entry.startsWith('DEV_OWNER_ROOT='))
        ?.slice(15);
      const boot = env
        .find((entry) => entry.startsWith('DEV_OWNER_BOOT='))
        ?.slice(15);
      if (root)
        stamps.set(pid, {
          root,
          boot: boot ?? null,
          cwd: readlinkSync(`/proc/${pid}/cwd`),
        });
    } catch {
      /* process exited or belongs to another OS user */
    }
  }
  return stamps;
}
