// @io-wall-ok — read-only stack plan adapter, safe in Node build-tool config.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StackPlan } from './stack-plan';

export function stackRootDir(repoRoot: string): string {
  return join(repoRoot, '.cache', 'localhost-stack');
}

export function planPath(repoRoot: string, instanceId: string): string {
  return join(stackRootDir(repoRoot), instanceId, 'plan.json');
}

export function readPlan(repoRoot: string, instanceId: string): StackPlan {
  const path = planPath(repoRoot, instanceId);
  if (!existsSync(path)) {
    throw new Error(
      `no plan for stack instance '${instanceId}' — \`dev:prepare\` writes it (${path})`
    );
  }
  return JSON.parse(readFileSync(path, 'utf8')) as StackPlan;
}
