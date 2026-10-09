import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { verify } from '@pkgs/quint-server/verify';

const FIXTURE = join(import.meta.dir, 'fixtures/door-induction.qnt');
const OUT = join(import.meta.dir, '../.cache/test-verify-bounded-groups');
const TIMEOUT_MS = 120_000;

test.concurrent(
  'a violation in the later bounded group rejects the complete proof',
  async () => {
    const outDir = join(OUT, 'later-violation');
    const result = await verify({
      specPath: FIXTURE,
      invariants: ['invKnownState', 'invNeverOpen'],
      maxSteps: 2,
      boundedInvariantGroupSize: 1,
      outDir,
      timeoutMs: TIMEOUT_MS,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.output).toContain('found a counterexample');
    expect(result.output).toContain('[State 1] { state: "open" }');
    expect(existsSync(join(outDir, 'case-1/_apalache-out'))).toBe(true);
  },
  TIMEOUT_MS
);

test.concurrent(
  'every safe bounded group produces its own completed solver check',
  async () => {
    const outDir = join(OUT, 'safe');
    const result = await verify({
      specPath: FIXTURE,
      invariants: ['invKnownState', '_inductive'],
      maxSteps: 2,
      boundedInvariantGroupSize: 1,
      outDir,
      timeoutMs: TIMEOUT_MS,
    });
    expect(result.ok).toBe(true);
    for (const index of [0, 1])
      expect(existsSync(join(outDir, `case-${index}/_apalache-out`))).toBe(
        true
      );
  },
  TIMEOUT_MS
);
