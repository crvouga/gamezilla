import { execSync } from 'node:child_process';

/**
 * SIGKILL leftover `esbuild --service` workers.
 *
 * esbuild's JS API spawns a persistent native service and `unref()`s it. If the
 * parent exits without `esbuild.stop()` (or is SIGKILL'd), launchd (ppid 1)
 * adopts the service and it stays in Activity Monitor forever.
 *
 * Only matches the long-lived `--service` workers — not one-shot CLI builds.
 * Callers should pass `commandIncludes` (e.g. the monorepo root) so other
 * checkouts on the same machine are left alone.
 */

export type KillEsbuildServicesOptions = {
  /**
   * Only kill services whose `ps` command line contains this substring.
   * Typically the monorepo root path (e.g. `/Users/…/gamezilla`).
   */
  readonly commandIncludes?: string;
};

type EsbuildService = {
  readonly pid: number;
  readonly ppid: number;
  readonly command: string;
};

function parsePsLine(line: string): EsbuildService | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  const match = /^(\d+)\s+(\d+)\s+(.*)$/.exec(trimmed);
  if (match === null) return null;
  const pid = Number.parseInt(match[1] ?? '', 10);
  const ppid = Number.parseInt(match[2] ?? '', 10);
  const command = match[3] ?? '';
  if (!Number.isInteger(pid) || pid <= 1) return null;
  if (!Number.isInteger(ppid)) return null;
  return { pid, ppid, command };
}

function isEsbuildService(
  service: EsbuildService,
  needle: string | undefined
): boolean {
  if (service.pid === process.pid) return false;
  if (!service.command.includes('esbuild')) return false;
  if (!service.command.includes('--service')) return false;
  if (needle !== undefined && needle.length > 0) {
    if (!service.command.includes(needle)) return false;
  }
  return true;
}

function listEsbuildServices(
  options: KillEsbuildServicesOptions = {}
): EsbuildService[] {
  if (process.platform === 'win32') return [];

  let out: string;
  try {
    out = execSync('ps -axo pid=,ppid=,command=', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    return [];
  }

  const needle = options.commandIncludes;
  const services: EsbuildService[] = [];
  for (const line of out.split('\n')) {
    const parsed = parsePsLine(line);
    if (parsed === null) continue;
    if (!isEsbuildService(parsed, needle)) continue;
    services.push(parsed);
  }
  return services;
}

function killPids(pids: readonly number[]): void {
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already exited
    }
  }
}

/** Kill `esbuild --service` processes adopted by PID 1 (true orphans). */
export function killOrphanEsbuildServices(
  options: KillEsbuildServicesOptions = {}
): void {
  const orphans = listEsbuildServices(options)
    .filter((s) => s.ppid === 1)
    .map((s) => s.pid);
  killPids(orphans);
}

/**
 * Kill every matching `esbuild --service` process. Use when tearing down the
 * whole local stack (`bun run kill`) — may stop services still owned by a live
 * wrangler in this repo.
 */
export function killAllEsbuildServices(
  options: KillEsbuildServicesOptions = {}
): void {
  killPids(listEsbuildServices(options).map((s) => s.pid));
}
