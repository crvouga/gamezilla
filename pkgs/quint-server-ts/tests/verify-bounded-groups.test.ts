import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verify } from '@pkgs/quint-server-ts/verify';

const FIXTURE = join(import.meta.dir, 'fixtures/door-induction.qnt');
const OUT = join(import.meta.dir, '../.cache/test-verify-bounded-groups');
const TIMEOUT_MS = 120_000;

test.concurrent(
  'before mode rejects a violation in a later bounded group',
  async () => {
    // regression: username-proof-solver-timeout
    const outDir = join(OUT, 'before-later-violation');
    const result = await verify({
      specPath: FIXTURE,
      invariants: ['invKnownState', 'invNeverOpen'],
      maxSteps: 2,
      boundedInvariantGroupSize: 1,
      invariantMode: 'before',
      outDir,
      timeoutMs: TIMEOUT_MS,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.output).toContain('found a counterexample');
    expect(result.output).toContain('[State 1] { state: "open" }');
    const config = JSON.parse(
      readFileSync(join(outDir, 'case-1/apalache-config.json'), 'utf8')
    );
    expect(config).toMatchObject({
      checker: { tuning: { 'search.invariant.mode': 'before' } },
    });
  },
  TIMEOUT_MS
);

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

test.concurrent(
  'a selected later bounded phase retains its bound and rejects a violation',
  async () => {
    // regression: multiplayer-bounded-proof-timeout
    const outDir = join(OUT, 'selected-later-violation');
    const result = await verify({
      specPath: FIXTURE,
      invariants: ['invKnownState', 'invNeverOpen'],
      maxSteps: 2,
      boundedInvariantGroupSize: 1,
      phase: { indexes: [1], count: 2 },
      outDir,
      timeoutMs: TIMEOUT_MS,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.output).toContain('found a counterexample');
    expect(result.output).toContain('[State 1] { state: "open" }');
    expect(existsSync(join(outDir, 'case-0/_apalache-out'))).toBe(false);
    expect(existsSync(join(outDir, 'case-1/_apalache-out'))).toBe(true);
  },
  TIMEOUT_MS
);
