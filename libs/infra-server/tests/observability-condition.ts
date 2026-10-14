import { expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const tofu = Bun.spawnSync(['mise', 'which', 'tofu']).stdout.toString().trim();
const module = readFileSync(
  join(
    import.meta.dirname,
    '../../infra-shared/tofu/modules/observability/main.tf'
  ),
  'utf8'
);

const condition = module.match(/condition\s*=\s*([^\n]+)/)?.[1];
if (condition === undefined) throw new Error('Stack postcondition missing');
// This predicate compares entire strings with literals. Those literals and
// one other value exhaust its equivalence classes. Reject new expression
// forms so a future rule cannot silently outgrow this finite evaluation.
if (
  !/^contains\(\s*\[(?:\s*"[^"\\]*"\s*,?)+\],\s*self\.status\s*\)\s*&&\s*self\.traces_status\s*==\s*"[^"\\]*"\s*$/.test(
    condition
  )
)
  throw new Error('Stack postcondition needs a new evaluation strategy');
const literals = [
  ...new Set([...condition.matchAll(/"([^"\\]*)"/g)].map((m) => m[1]!)),
];
let other = '';
while (literals.includes(other)) other += '?';
const values = [...literals, other];
const inputs = values.flatMap((status) =>
  values.map((traces_status) => ({ status, traces_status }))
);

// OpenTofu evaluates the actual deployed predicate for every class in one
// process, rather than launching a process for each property sample.
function evaluate(): boolean[] {
  const result = Bun.spawnSync([tofu, 'console', '-no-color'], {
    cwd: import.meta.dirname,
    stdin: Buffer.from(
      `jsonencode([for self in ${JSON.stringify(inputs)} : ${condition}])\n`
    ),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  expect(result.stderr.toString()).toBe('');
  expect(result.exitCode).toBe(0);
  const encoded = JSON.parse(result.stdout.toString().trim());
  if (typeof encoded !== 'string')
    throw new Error('Expected OpenTofu JSON string');
  return JSON.parse(encoded) as boolean[];
}

const outcomes = evaluate();
expect(outcomes).toHaveLength(inputs.length);

export function permits(stack: {
  status: string;
  traces_status: string;
}): boolean {
  const index = (value: string) =>
    values.indexOf(literals.includes(value) ? value : other);
  return outcomes[
    index(stack.status) * values.length + index(stack.traces_status)
  ]!;
}
