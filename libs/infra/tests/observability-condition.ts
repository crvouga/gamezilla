import { expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const tofu = Bun.spawnSync(['mise', 'which', 'tofu']).stdout.toString().trim();
const module = readFileSync(
  join(import.meta.dirname, '../tofu/modules/observability/main.tf'),
  'utf8'
);

// Evaluate the deployed module's actual predicate with OpenTofu, without
// providers, credentials, state or a copy of the rule in TypeScript.
export function permits(stack: {
  status: string;
  traces_status: string;
}): boolean {
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
