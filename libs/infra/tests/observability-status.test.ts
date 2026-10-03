import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const tofu = Bun.spawnSync(['mise', 'which', 'tofu']).stdout.toString().trim();
const module = readFileSync(
  join(import.meta.dirname, '../tofu/modules/observability/main.tf'),
  'utf8'
);

// Evaluate the deployed module's actual predicate with OpenTofu, without
// providers, credentials, state or a copy of the rule in TypeScript.
function permits(stack: { status: string; traces_status: string }): boolean {
  const condition = module.match(/condition\s*=\s*([^\n]+)/)?.[1];
  if (condition === undefined) throw new Error('Stack postcondition missing');
  const result = Bun.spawnSync([tofu, 'console', '-no-color'], {
    cwd: import.meta.dirname,
    stdin: Buffer.from(
      `${condition.replace(/\bself\b/g, JSON.stringify(stack))}\n`
    ),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  expect(result.stderr.toString()).toBe('');
  expect(result.exitCode).toBe(0);
  return result.stdout.toString().trim() === 'true';
}

// regression: deploy-grafana-archived-active-traces
test('archived stack with active traces remains usable by the trace-only module', () => {
  // Grafana stack 1842412 / shortawning2091 at the failed deploy:
  // status=archived, htInstanceStatus=active; Tempo search returned HTTP 200.
  expect(permits({ status: 'archived', traces_status: 'active' })).toBe(true);
});

test('unavailable traces and terminal or unknown stack states fail closed', () => {
  for (const status of ['active', 'paused', 'archived']) {
    expect(permits({ status, traces_status: 'active' })).toBe(true);
    for (const traces_status of [
      'archived',
      'deleted',
      'deleting',
      'unknown',
    ]) {
      expect(permits({ status, traces_status })).toBe(false);
    }
  }
  for (const status of ['deleted', 'deleting', 'unknown']) {
    expect(permits({ status, traces_status: 'active' })).toBe(false);
  }
});
