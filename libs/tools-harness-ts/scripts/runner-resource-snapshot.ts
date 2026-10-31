/** Linux resource counters, projected through bounded injected reads. */
export type ResourceRead = (path: string, maxBytes: number) => string | null;
export const RESOURCE_READ_BYTES = 4096;
export const RESOURCE_MOUNT_BYTES = 16384;

function read(
  readFile: ResourceRead,
  path: string,
  max = RESOURCE_READ_BYTES
): string {
  try {
    return (readFile(path, max) ?? '').slice(0, max);
  } catch {
    return '';
  }
}

function number(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

function field(source: string, key: string): number | null {
  return number(
    source
      .split('\n')
      .find((line) => line.startsWith(`${key} `))
      ?.trim()
      .split(/\s+/)[1]
  );
}

function bytes(source: string, key: string): number | null {
  const value = number(
    source
      .split('\n')
      .find((line) => line.startsWith(`${key}:`))
      ?.trim()
      .split(/\s+/)[1]
  );
  return value !== null && Number.isSafeInteger(value * 1024)
    ? value * 1024
    : null;
}

function safePath(value: string): boolean {
  return (
    value.startsWith('/') &&
    value.length <= 2048 &&
    !value.split('/').includes('..') &&
    !/[\x00-\x1f]/.test(value)
  );
}

/** Resolve the process's v2 group against its actual mount, including namespace roots. */
function cgroupDirectory(readFile: ResourceRead): string | null {
  const group = read(readFile, '/proc/self/cgroup')
    .split('\n')
    .find((line) => line.startsWith('0::'))
    ?.slice(3);
  if (group === undefined || !safePath(group)) return null;
  const mounts = read(readFile, '/proc/self/mountinfo', RESOURCE_MOUNT_BYTES);
  for (const line of mounts.split('\n')) {
    const [before, after] = line.split(' - ');
    if (!after?.startsWith('cgroup2 ')) continue;
    const parts = (before ?? '').split(' ');
    const root = parts[3]?.replace(/\\([0-7]{3})/g, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 8))
    );
    const mount = parts[4]?.replace(/\\([0-7]{3})/g, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 8))
    );
    if (
      root === undefined ||
      mount === undefined ||
      !safePath(root) ||
      !safePath(mount)
    )
      continue;
    if (root !== '/' && group !== root && !group.startsWith(`${root}/`))
      continue;
    return `${mount.replace(/\/$/, '')}/${group.slice(root === '/' ? 1 : root.length).replace(/^\//, '')}`.replace(
      /\/$/,
      ''
    );
  }
  return null;
}

function cpu(source: string) {
  const row = source.split('\n')[0]?.trim().split(/\s+/) ?? [];
  const ticks = row.slice(1, 9).map(number);
  const valid =
    row[0] === 'cpu' && ticks.length === 8 && ticks.every((n) => n !== null);
  const total = valid
    ? ticks.reduce<number>((sum, n) => sum + (n ?? 0), 0)
    : null;
  return {
    cpuTicks: total !== null && Number.isSafeInteger(total) ? total : null,
    cpuIdleTicks: valid ? (ticks[3] ?? null) : null,
    cpuStealTicks: valid ? (ticks[7] ?? null) : null,
  };
}

function pressure(source: string, kind: 'some' | 'full'): number | null {
  const row = source.split('\n').find((line) => line.startsWith(`${kind} `));
  return number(
    row
      ?.split(/\s+/)
      .find((part) => part.startsWith('total='))
      ?.slice(6)
  );
}

export function sampleRunnerResources(readFile: ResourceRead, atMs: number) {
  const group = cgroupDirectory(readFile);
  const cgroup = (file: string) =>
    group === null ? '' : read(readFile, `${group}/${file}`);
  const quota = cgroup('cpu.max').trim().split(/\s+/);
  const stats = cgroup('cpu.stat');
  const events = cgroup('memory.events');
  const memory = read(readFile, '/proc/meminfo');
  const memoryPressure = read(readFile, '/proc/pressure/memory');
  return {
    atMs: Number.isFinite(atMs) && atMs >= 0 ? atMs : null,
    gauges: {
      cgroupVersion: group === null ? null : 2,
      cpuQuotaUs: number(quota[0]),
      cpuPeriodUs: number(quota[1]),
      memoryTotalBytes: bytes(memory, 'MemTotal'),
      memoryAvailableBytes: bytes(memory, 'MemAvailable'),
      cgroupMemoryBytes: number(cgroup('memory.current').trim()),
      cgroupMemoryLimitBytes: number(cgroup('memory.max').trim()),
      memoryHighEvents: field(events, 'high'),
      memoryMaxEvents: field(events, 'max'),
      memoryOomEvents: field(events, 'oom'),
      memoryOomKills: field(events, 'oom_kill'),
    },
    counters: {
      ...cpu(read(readFile, '/proc/stat')),
      cpuUsageUs: field(stats, 'usage_usec'),
      cpuThrottledUs: field(stats, 'throttled_usec'),
      cpuPeriods: field(stats, 'nr_periods'),
      cpuThrottledPeriods: field(stats, 'nr_throttled'),
      hostCpuPressureSomeUs: pressure(
        read(readFile, '/proc/pressure/cpu'),
        'some'
      ),
      hostMemoryPressureSomeUs: pressure(memoryPressure, 'some'),
      hostMemoryPressureFullUs: pressure(memoryPressure, 'full'),
      hostIoPressureFullUs: pressure(
        read(readFile, '/proc/pressure/io'),
        'full'
      ),
    },
  };
}

export type RunnerResourceSample = ReturnType<typeof sampleRunnerResources>;
