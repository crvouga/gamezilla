// @io-wall-ok — compact plan transport, with no credentials or runtime metadata.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { CheckPlan } from './check-shards';

const DIRECTORY = join(import.meta.dirname, '../../../.cache/check-ci');
const FILES = [
  'plan.json',
  'planning.json',
  'context.json',
  'audit.json',
] as const;

export function encodePlan(files: Readonly<Record<string, string>>): string {
  const compact = { ...files };
  if (compact['plan.json']) {
    const plan = JSON.parse(compact['plan.json']) as CheckPlan;
    if (plan.shards)
      compact['plan.json'] = JSON.stringify({
        ...plan,
        shards: plan.shards.map((shard) => ({
          ...shard,
          tasks: shard.tasks.map((task) => task.taskId),
        })),
      });
  }
  return gzipSync(JSON.stringify(compact), { level: 9 }).toString('base64');
}

export function decodePlan(payload: string): Record<string, string> {
  const files = JSON.parse(
    gunzipSync(Buffer.from(payload, 'base64')).toString()
  ) as Record<string, string>;
  if (files['plan.json']) {
    const plan = JSON.parse(files['plan.json']) as Omit<CheckPlan, 'shards'> & {
      shards: (Omit<CheckPlan['shards'][number], 'tasks'> & {
        tasks: string[];
      })[];
    };
    if (plan.shards) {
      const tasks = new Map(
        plan.tasks.map((task: CheckPlan['tasks'][number]) => [
          task.taskId,
          task,
        ])
      );
      files['plan.json'] = JSON.stringify({
        ...plan,
        shards: plan.shards.map((shard) => ({
          ...shard,
          tasks: shard.tasks.map((id) => {
            const task = tasks.get(id);
            if (!task) throw new Error(`Unknown transported task: ${id}`);
            return task;
          }),
        })),
      });
    }
  }
  return files;
}

export function packPlan(): string {
  return encodePlan(
    Object.fromEntries(
      FILES.map((name) => [name, readFileSync(join(DIRECTORY, name), 'utf8')])
    )
  );
}

export function restorePlan(payload: string): void {
  const files = decodePlan(payload);
  mkdirSync(DIRECTORY, { recursive: true });
  for (const name of FILES) writeFileSync(join(DIRECTORY, name), files[name]!);
}

if (import.meta.main) {
  const started = process.hrtime.bigint();
  if (process.argv[2] === '--export') {
    const payload = packPlan();
    console.log(`Execution plan: ${payload.length} compressed transport bytes`);
    writeFileSync(join(DIRECTORY, 'plan.payload'), payload);
  } else {
    restorePlan(readFileSync(join(DIRECTORY, 'plan.payload'), 'utf8'));
  }
  console.log(
    `Plan transfer: ${(Number(process.hrtime.bigint() - started) / 1e6).toFixed(1)}ms`
  );
}
