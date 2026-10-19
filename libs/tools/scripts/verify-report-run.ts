// @io-wall-ok — Verification orchestration: child process streams and upload timings.
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { ReportTaskIdentity } from './verify-report-stream';
import { createReportPublisher } from './verify-report-stream';

const REPO_ROOT = join(import.meta.dirname, '../../..');

function publish(
  taskId: string,
  env: NodeJS.ProcessEnv,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted)
    return Promise.reject(new Error('Report publication cancelled'));
  return new Promise((resolve, reject) => {
    const started = process.hrtime.bigint();
    const child = spawn(
      'bun',
      ['run', 'libs/harness/scripts/report-publish.ts', 'task', taskId],
      {
        cwd: REPO_ROOT,
        env,
        stdio: 'inherit',
        signal,
      }
    );
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Publishing ${taskId} exited ${String(code)}`));
        return;
      }
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      try {
        writeUploadSummary(taskId, seconds);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

function writeUploadSummary(taskId: string, seconds: number): void {
  const dir = join(REPO_ROOT, '.turbo/report-runs');
  mkdirSync(dir, { recursive: true });
  const id = taskId
    .replace('#test:spec:', '#publish:spec:')
    .replace('#verify:ui-quality', '#publish:ui-quality');
  writeFileSync(
    join(dir, `publish-${id.replace(/[^a-z0-9-]/g, '-')}.json`),
    JSON.stringify({
      tasks: [
        {
          taskId: id,
          cache: { status: 'MISS' },
          execution: { startTime: 0, endTime: seconds * 1000 },
        },
      ],
    })
  );
  console.log(`verify: ${taskId} published in ${seconds.toFixed(1)}s`);
}

export function observeReportOutput(
  child: ChildProcess,
  tasks: readonly ReportTaskIdentity[],
  env: NodeJS.ProcessEnv,
  signal: AbortSignal
): Promise<void> {
  const publisher = createReportPublisher(tasks, {
    publish: (taskId) => publish(taskId, env, signal),
    log: (line) => console.log(line),
  });
  if (child.stdout === null) throw new Error('Turbo report stream is missing');
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => publisher.line(line));
  return new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      publisher.finish(code !== 0).then(resolve, reject);
    });
  });
}
