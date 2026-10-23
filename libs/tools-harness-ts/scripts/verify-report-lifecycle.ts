// @io-wall-ok — Verification composition root: prepare/close reports using the exact gate plan.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { reportTask } from '@libs/harness-ts/report-ready';
import type { RunPlan } from './turbo-preflight';

const ROOT = join(import.meta.dirname, '../../..');

function reportCommand(
  command: readonly string[],
  env: NodeJS.ProcessEnv
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'bun',
      ['run', 'libs/harness-ts/scripts/report-publish.ts', ...command],
      {
        cwd: ROOT,
        env,
        stdio: 'inherit',
      }
    );
    const stop = () => child.kill('SIGTERM');
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    child.on('error', reject);
    child.on('close', (code) => {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      code === 0
        ? resolve()
        : reject(new Error(`Report ${command[0]} exited ${String(code)}`));
    });
  });
}

export async function prepareReports(
  plan: RunPlan,
  env: NodeJS.ProcessEnv
): Promise<readonly string[]> {
  const directory = join(ROOT, '.turbo');
  mkdirSync(directory, { recursive: true });
  const path = join(directory, 'verify-report-plan.json');
  writeFileSync(path, JSON.stringify({ generation: 0, tasks: plan.tasks }));
  env['VERIFY_REPORT_PLAN_PATH'] = path;
  await reportCommand(['prepare'], env);
  const missing = JSON.parse(
    readFileSync(`${path}.missing.json`, 'utf8')
  ) as string[];
  if (
    !Array.isArray(missing) ||
    missing.some(
      (id) =>
        typeof id !== 'string' ||
        reportTask(id) === null ||
        !plan.tasks.some((task) => task.taskId === id)
    )
  )
    throw new Error('Invalid report restore set');
  return missing;
}

export function completeReports(
  status: number,
  env: NodeJS.ProcessEnv
): Promise<void> {
  return reportCommand(['close', ...(status === 0 ? [] : ['failed'])], env);
}
