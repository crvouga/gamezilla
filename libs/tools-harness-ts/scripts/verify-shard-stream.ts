/** Structured Turbo output: preserve failing output without replaying successful suites. */
import { taskBudgetSeconds } from './verify-budget';
import type { StreamSnapshot } from './verify-shard-diagnosis';
import type { VerifyTask } from './verify-shards';

const TAIL_LINES = 40;
/** Turbo's word that a task's command is over and non-zero. */
const EXITED =
  /command finished with error|command .*exited|error: script .*exited with code [1-9]/;
const FAILURE = new RegExp(`${EXITED.source}|^\\(fail\\)`);
type TaskFailure = Omit<StreamSnapshot['failed'][number], 'taskId'>;

function tailOf(output: string): string {
  return output.trimEnd().split('\n').slice(-TAIL_LINES).join('\n');
}

/** Turbo reports binary-script failures on its own source, outside the task's output. */
function failedTaskIds(
  text: string,
  tasks: readonly VerifyTask[]
): readonly string[] {
  const listed = /^\s*Failed:\s+(.+)$/.exec(text)?.[1];
  if (listed !== undefined) return listed.split(/,\s*/);
  const exit = /^command \((.+)\) .+ run (\S+) exited \(([1-9]\d*)\)$/.exec(
    text
  );
  if (exit === null) return [];
  const directory = exit[1]!.replaceAll('\\', '/');
  return tasks
    .filter((task) => {
      const relative = task.directory
        .replaceAll('\\', '/')
        .replace(/^\.\//, '');
      return (
        task.taskId.endsWith(`#${exit[2]}`) &&
        (directory === relative || directory.endsWith(`/${relative}`))
      );
    })
    .map((task) => task.taskId);
}

export function taskStream(
  tasks: readonly VerifyTask[],
  log: (line: string) => void,
  ports: { now: () => number; completed: (task: VerifyTask) => boolean }
) {
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  const logs = new Map<string, string>();
  const started = new Map<string, number>();
  const finished = new Map<string, number>();
  const failed = new Map<string, TaskFailure>();
  const reportFailure = (id: string, detail: string): void => {
    const task = byId.get(id);
    if (task === undefined) return;
    const seconds = (ports.now() - (started.get(id) ?? ports.now())) / 1000;
    log(
      `FAILED ${id}; command: ${task.command}; elapsed: ${seconds.toFixed(3)}s; ${detail}`
    );
    const output = logs.get(id) ?? '';
    log(output);
    failed.set(id, { seconds, detail, tail: tailOf(output) });
  };
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
      for (const id of failedTaskIds(event.text, tasks)) {
        if (!failed.has(id)) reportFailure(id, event.text);
        started.delete(id);
      }
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
    if (event.level === 'error' || FAILURE.test(event.text)) {
      reportFailure(event.source, event.text);
      // The task is over once its script exits non-zero: it must not linger as
      // "running" until its time budget and then be reported as a timeout.
      if (EXITED.test(event.text)) started.delete(event.source);
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
        finished.set(id, seconds);
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
      `Verification heartbeat: ${started.size} running; ${[...started].map(([id, start]) => `${id} ${((ports.now() - start) / 1000).toFixed(0)}s`).join('; ')}`
    );
  }
  const snapshot = (): StreamSnapshot =>
    streamSnapshot(ports.now(), started, finished, failed);
  return Object.assign(line, { tick, heartbeat, snapshot });
}

/** What the shard had done, was doing and had failed at, right now. */
function streamSnapshot(
  now: number,
  started: ReadonlyMap<string, number>,
  finished: ReadonlyMap<string, number>,
  failed: ReadonlyMap<string, TaskFailure>
): StreamSnapshot {
  const running = [...started].map(([taskId, start]) => ({
    taskId,
    seconds: (now - start) / 1000,
  }));
  return {
    running,
    finished: [...finished].map(([taskId, seconds]) => ({ taskId, seconds })),
    failed: [...failed].map(([taskId, item]) => ({ taskId, ...item })),
    overBudget: running
      .map((task) => ({
        ...task,
        budget: taskBudgetSeconds(task.taskId, true),
      }))
      .filter((task) => task.seconds > task.budget),
  };
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
