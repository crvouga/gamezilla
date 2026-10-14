import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { verify } from '@pkgs/quint-server/verify';

const TIMEOUT_MS = 120_000;

test(
  'checking before combining successors still rejects a later induction choice',
  async () => {
    // regression: custom-game-proof-solver-timeout
    const result = await verify({
      specPath: join(import.meta.dir, 'fixtures/door-induction-choices.qnt'),
      invariants: ['invNeverOpen'],
      inductiveInvariant: 'invNeverOpen',
      separateInduction: true,
      inductionCaseGroupSize: 8,
      invariantMode: 'before',
      maxSteps: 4,
      outDir: join(import.meta.dir, '../.cache/test-verify-before-induction'),
      timeoutMs: TIMEOUT_MS,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.output).toContain('; preservation)');
    expect(result.output).toContain('found a counterexample');
    expect(result.output).toContain('[State 1] { state: "open" }');
  },
  TIMEOUT_MS
);
