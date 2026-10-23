import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verify } from '@pkgs/quint-server-ts/verify';

const TIMEOUT_MS = 120_000;

test(
  'Boolean short-circuit translation still rejects a reachable violation',
  async () => {
    const outDir = join(import.meta.dir, '../.cache/test-verify-short-circuit');
    const result = await verify({
      specPath: join(import.meta.dir, 'fixtures/door-induction.qnt'),
      invariants: ['invKnownState', 'invNeverOpen'],
      maxSteps: 2,
      shortCircuit: true,
      outDir,
      timeoutMs: TIMEOUT_MS,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.output).toContain('An example execution:');
    expect(result.output).toContain('[State 1] { state: "open" }');
    const config = JSON.parse(
      readFileSync(join(outDir, 'apalache-config.json'), 'utf8')
    );
    expect(config).toMatchObject({
      checker: { tuning: { 'rewriter.shortCircuit': true } },
    });
  },
  TIMEOUT_MS
);
