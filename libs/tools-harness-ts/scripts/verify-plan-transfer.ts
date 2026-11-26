// @io-wall-ok — compact plan transport, with no credentials or runtime metadata.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { VerifyPlan } from './verify-shards';

const DIRECTORY = join(import.meta.dirname, '../../../.cache/verify-ci');
const FILES = [
  'plan.json',
  'planning.json',
  'context.json',
  // The profile and its depth, kept with the nightly run's details.
  'profile.json',
  'audit.json',
] as const;

export function encodePlan(files: Readonly<Record<string, string>>): string {
  const compact = { ...files };
  if (compact['plan.json']) {
    const plan = JSON.parse(compact['plan.json']) as VerifyPlan;
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
    const plan = JSON.parse(files['plan.json']) as Omit<
      VerifyPlan,
      'shards'
    > & {
      shards: (Omit<VerifyPlan['shards'][number], 'tasks'> & {
        tasks: string[];
      })[];
    };
    if (plan.shards) {
      const tasks = new Map(
        plan.tasks.map((task: VerifyPlan['tasks'][number]) => [
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

/** A production shard installs only the pinned CLIs its cache misses execute. */
export function deploymentTools(
  tasks: readonly { readonly hit: boolean; readonly taskId: string }[]
): string {
  const tools = new Set(['bun', 'node']);
  const byTask: Readonly<Record<string, readonly string[]>> = {
    '@libs/tools-harness-ts#verify:actionlint': ['actionlint'],
    '@libs/tools-harness-ts#verify:secrets': ['gitleaks'],
    '@libs/tools-harness-ts#verify:workflow-security': ['zizmor'],
    '@libs/infra-server-ts#verify:repository-policy': ['opentofu', 'conftest'],
    '@libs/infra-server-ts#test': ['opentofu', 'conftest'],
    '@pkgs/auth-root-harness-ts#test': ['java', 'http:alloy', 'http:apalache'],
  };
  for (const { hit, taskId } of tasks) {
    if (hit) continue;
    for (const tool of byTask[taskId] ?? []) tools.add(tool);
    if (taskId.startsWith('@apps/product-ts#test:release-journeys:'))
      tools.add('github:emqx/emqx');
  }
  return [...tools].sort().join(' ');
}

export function packPlan(): string {
  const files = Object.fromEntries(
    FILES.map((name) => [name, readFileSync(join(DIRECTORY, name), 'utf8')])
  );
  if (process.env['VERIFY_DEPLOYMENT'] === 'true') {
    const plan = JSON.parse(files['plan.json']!) as VerifyPlan;
    files['deployment-tools'] = JSON.stringify(
      plan.shards.map((shard) => deploymentTools(shard.tasks))
    );
  }
  return encodePlan(files);
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
