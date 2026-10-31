import type { RunnerResourceSample } from './runner-resource-snapshot';

export type ResourceReason =
  | 'start'
  | 'heartbeat'
  | 'task-timeout'
  | 'shard-timeout';
export const RESOURCE_LOG_CHARS = 4096;

function delta(
  current: number | null,
  previous: number | null | undefined
): number | null {
  return current !== null && previous != null && current >= previous
    ? current - previous
    : null;
}

/** Only fixed numeric fields reach the log; a reset counter has no meaningful delta. */
export function resourceMetrics(
  current: RunnerResourceSample,
  previous?: RunnerResourceSample
) {
  const count = (key: keyof RunnerResourceSample['counters']) =>
    delta(current.counters[key], previous?.counters[key]);
  return {
    elapsedMs: delta(current.atMs, previous?.atMs),
    ...current.gauges,
    cpuTicksDelta: count('cpuTicks'),
    cpuIdleTicksDelta: count('cpuIdleTicks'),
    cpuStealTicksDelta: count('cpuStealTicks'),
    cpuUsageUsDelta: count('cpuUsageUs'),
    cpuThrottledUsDelta: count('cpuThrottledUs'),
    cpuPeriodsDelta: count('cpuPeriods'),
    cpuThrottledPeriodsDelta: count('cpuThrottledPeriods'),
    hostCpuPressureSomeUsDelta: count('hostCpuPressureSomeUs'),
    hostMemoryPressureSomeUsDelta: count('hostMemoryPressureSomeUs'),
    hostMemoryPressureFullUsDelta: count('hostMemoryPressureFullUs'),
    hostIoPressureFullUsDelta: count('hostIoPressureFullUs'),
  };
}

/** Sampling failure must never change task execution or conceal its original timeout. */
export function runnerResourceDiagnostics(ports: {
  readonly sample: () => RunnerResourceSample;
  readonly log: (line: string) => void;
}): (reason: ResourceReason) => void {
  let previous: RunnerResourceSample | undefined;
  return (reason) => {
    try {
      const current = ports.sample();
      const data = JSON.stringify(resourceMetrics(current, previous));
      previous = current;
      ports.log(
        `Runner resources (${reason}): ${data}`.slice(0, RESOURCE_LOG_CHARS)
      );
    } catch {
      // Fixed fallback: never print exception text, file paths or machine data.
      try {
        ports.log(`Runner resources (${reason}): {"available":0}`);
      } catch {
        /* Resource diagnostics cannot change a verification verdict. */
      }
    }
  };
}
