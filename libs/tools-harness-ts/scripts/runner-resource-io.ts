// @io-wall-ok — shard entry adapter reads bounded kernel resource counters only.
import { closeSync, openSync, readSync } from 'node:fs';
import { runnerResourceDiagnostics } from './runner-resource-diagnostics';
import { sampleRunnerResources } from './runner-resource-snapshot';

function readKernelPrefix(path: string, maxBytes: number): string | null {
  if (process.platform !== 'linux') return null;
  let fd: number | undefined;
  try {
    fd = openSync(path, 'r');
    const buffer = Buffer.alloc(maxBytes);
    const count = readSync(fd, buffer, 0, maxBytes, 0);
    return buffer.subarray(0, count).toString('utf8');
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function createRunnerResourceDiagnostics(log: (line: string) => void) {
  return runnerResourceDiagnostics({
    sample: () =>
      sampleRunnerResources(
        readKernelPrefix,
        Number(process.hrtime.bigint()) / 1e6
      ),
    log,
  });
}
