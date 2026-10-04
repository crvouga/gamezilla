/** Structured Turbo output: preserve failing output without replaying successful suites. */
import { taskBudgetSeconds } from './check-budget';
import type { CheckTask } from './check-shards';

export function taskStream(
  tasks: readonly CheckTask[],
  log: (line: string) => void,
  ports: { now: () => number; completed: (task: CheckTask) => boolean }
) {
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  const logs = new Map<string, string>();
  const started = new Map<string, number>();
  const line = (line: string): void => {
    let event: { source: string; text: string; level: string };
    try {
      event = JSON.parse(line) as typeof event;
    } catch {
      log(line);
      return;
    }
    if (typeof event.text !== 'string' || typeof event.source !== 'string') {
      log(line);
      return;
    }
    const task = byId.get(event.source);
    if (!task) {
      if (event.text.includes('command finished with error, but continuing'))
        return;
      log(event.text);
      return;
    }
    if (/^cache (miss|bypass)/.test(event.text)) {
      started.set(event.source, ports.now());
      log(
        `START ${event.source}; command: ${task.command}; budget: ${taskBudgetSeconds(event.source, true)}s`
      );
    }
    if (/^cache hit/.test(event.text))
      log(`COMPLETE ${event.source}; cached; elapsed: 0s`);
    logs.set(
      event.source,
      `${logs.get(event.source) ?? ''}${event.text}\n`.slice(-65536)
    );
    if (
      event.level === 'error' ||
      /command finished with error|command .*exited|error: script .*exited with code [1-9]|^\(fail\)/.test(
        event.text
      )
    ) {
      const milliseconds =
        ports.now() - (started.get(event.source) ?? ports.now());
      if (/command finished with error|command .*exited/.test(event.text))
        started.delete(event.source);
      log(
        `FAILED ${event.source}; command: ${task.command}; elapsed: ${(milliseconds / 1000).toFixed(3)}s; ${event.text}`
      );
      log(logs.get(event.source)!);
    }
  };
  function tick(): string[] {
    const timedOut: string[] = [];
    for (const [id, start] of started) {
      const seconds = (ports.now() - start) / 1000;
      if (ports.completed(byId.get(id)!)) {
        log(
          `COMPLETE ${id}; elapsed: ${seconds.toFixed(1)}s; successful cache artifact written`
        );
        started.delete(id);
      } else if (seconds > taskBudgetSeconds(id, true)) {
        log(
          `TIMEOUT ${id}; command: ${byId.get(id)!.command}; elapsed: ${seconds.toFixed(1)}s; budget: ${taskBudgetSeconds(id, true)}s`
        );
        timedOut.push(id);
      }
    }
    return timedOut;
  }
  function heartbeat(): void {
    log(
      `Check heartbeat: ${started.size} running; ${[...started].map(([id, start]) => `${id} ${((ports.now() - start) / 1000).toFixed(0)}s`).join('; ')}`
    );
  }
  return Object.assign(line, { tick, heartbeat });
}

/** Environment values never enter uploaded diagnostics; provider masking remains in effect too. */
export function redactSecrets(text: string, env: NodeJS.ProcessEnv): string {
  let safe = text;
  for (const [key, value] of Object.entries(env))
    if (
      /(TOKEN|SECRET|PASSWORD|ACCESS_KEY|DATABASE_URL|PRIVATE_KEY)/.test(key) &&
      value &&
      value.length >= 4
    )
      safe = safe.replaceAll(value, '[REDACTED]');
  return safe;
}
