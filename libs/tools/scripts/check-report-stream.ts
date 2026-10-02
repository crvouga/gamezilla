import { REPORT_READY, reportTask } from '@libs/harness/ci/report-ready';

export type ReportPublisher = {
  line(line: string): void;
  finish(failed?: boolean): Promise<void>;
};

export type ReportTaskIdentity = {
  readonly taskId: string;
  readonly hash: string;
};

type PublishPorts = {
  publish(taskId: string): Promise<void>;
  log(line: string): void;
};

function readEvent(value: string) {
  const event = JSON.parse(value) as {
    source: string;
    text: string;
    level: string;
  };
  if (typeof event.source !== 'string' || typeof event.text !== 'string')
    throw new Error('Invalid Turbo structured event');
  return event;
}

/** Uploads overlap Turbo without consuming its CPU task slots. */
export function createReportPublisher(
  tasks: readonly ReportTaskIdentity[],
  ports: PublishPorts,
  width = 2
): ReportPublisher {
  const expected = new Map(
    tasks
      .filter((task) => reportTask(task.taskId) !== null)
      .map((task) => [task.taskId, task.hash])
  );
  const verified = new Set<string>();
  const seen = new Set<string>();
  const queue: string[] = [];
  const running = new Set<Promise<void>>();
  const failures: unknown[] = [];
  const logs = new Map<string, string>();
  function pump(): void {
    while (queue.length > 0 && running.size < Math.max(1, width)) {
      const taskId = queue.shift() as string;
      const work = ports
        .publish(taskId)
        .catch((error: unknown) => {
          failures.push(error);
        })
        .finally(() => {
          running.delete(work);
          pump();
        });
      running.add(work);
    }
  }
  function ready(taskId: string): void {
    if (!expected.has(taskId) || seen.has(taskId)) return;
    if (!verified.has(taskId))
      throw new Error(`Report task hash not verified: ${taskId}`);
    seen.add(taskId);
    queue.push(taskId);
    pump();
  }
  function line(value: string): void {
    try {
      const event = readEvent(value);
      // Turbo emits its cache-hit status after restoring the outputs, before
      // replaying logs. This also handles caches written before the marker existed.
      const cache = /^cache (hit|miss|bypass).* ([0-9a-f]{16,64})$/.exec(
        event.text.trim()
      );
      if (cache !== null && expected.has(event.source)) {
        if (cache[2] !== expected.get(event.source))
          throw new Error(
            `Report task hash changed after planning: ${event.source}`
          );
        verified.add(event.source);
      }
      if (
        event.text.trim() === REPORT_READY ||
        /^cache hit[, ]/.test(event.text)
      ) {
        ready(event.source);
      }
      if (event.source === 'turbo' || event.level === 'error')
        ports.log(event.text);
      else
        logs.set(
          event.source,
          `${logs.get(event.source) ?? ''}${event.text}\n`.slice(-65536)
        );
    } catch (error) {
      failures.push(error);
      ports.log(value);
    }
  }
  async function finish(failed = false): Promise<void> {
    while (running.size > 0) await Promise.all(running);
    const missing = [...expected.keys()].filter((id) => !seen.has(id));
    if (missing.length > 0)
      failures.push(
        new Error(`Reports never completed: ${missing.join(', ')}`)
      );
    if (failed || failures.length > 0) {
      for (const [source, output] of logs) ports.log(`${source}:\n${output}`);
    }
    if (failures.length === 0) return;
    throw new AggregateError(failures, 'Report publication failed');
  }
  return { line, finish };
}
