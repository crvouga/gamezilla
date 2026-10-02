/** Structured Turbo output: preserve failing output without replaying successful suites. */
import type { CheckTask } from './check-shards';

export function taskStream(tasks: readonly CheckTask[], log: (line: string) => void) {
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  const logs = new Map<string, string>();
  const started = new Map<string, bigint>();
  return (line: string): void => {
    let event: { source: string; text: string; level: string };
    try { event = JSON.parse(line); } catch { log(line); return; }
    const task = byId.get(event.source);
    if (!task) { log(event.text); return; }
    if (/^cache (miss|bypass)/.test(event.text)) started.set(event.source, process.hrtime.bigint());
    logs.set(event.source, `${logs.get(event.source) ?? ''}${event.text}\n`.slice(-65536));
    if (event.level === 'error' || /command finished with error|command .*exited/.test(event.text)) {
      const milliseconds = Number(process.hrtime.bigint() - (started.get(event.source) ?? process.hrtime.bigint())) / 1e6;
      log(`FAILED ${event.source}; command: ${task.command}; elapsed: ${(milliseconds / 1000).toFixed(3)}s; ${event.text}`);
      log(logs.get(event.source)!);
    }
  };
}

/** Environment values never enter uploaded diagnostics; provider masking remains in effect too. */
export function redactSecrets(text: string, env: NodeJS.ProcessEnv): string {
  let safe = text;
  for (const [key, value] of Object.entries(env))
    if (/(TOKEN|SECRET|PASSWORD|ACCESS_KEY|DATABASE_URL|PRIVATE_KEY)/.test(key) && value && value.length >= 4)
      safe = safe.replaceAll(value, '[REDACTED]');
  return safe;
}
