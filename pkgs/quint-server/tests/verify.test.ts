import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APALACHE_VERSION, resolveApalache } from '@pkgs/quint-server/apalache';
import { verify } from '@pkgs/quint-server/verify';

const FIXTURES = join(import.meta.dir, 'fixtures');
const OUT = join(import.meta.dir, '../.cache/test-verify');

/**
 * A check starts a JVM (Apalache): ~4 s idle on the door, far more under a
 * loaded gate. A limit near that would let machine load decide the verdict.
 */
const CHECK_TIMEOUT_MS = 120_000;

describe('verify', () => {
  test.concurrent(
    'a model whose invariant holds in every state within the bound passes',
    async () => {
      const outDir = join(OUT, 'door');
      const result = await verify({
        specPath: join(FIXTURES, 'door.qnt'),
        invariants: ['invKnownState'],
        maxSteps: 4,
        outDir,
        timeoutMs: CHECK_TIMEOUT_MS,
      });
      expect(result).toMatchObject({ ok: true });
      // Apalache worked in the check's own directory, not the caller's.
      expect(existsSync(join(outDir, '_apalache-out'))).toBe(true);
      expect(existsSync(join(import.meta.dir, '../_apalache-out'))).toBe(false);
    },
    CHECK_TIMEOUT_MS
  );

  test.concurrent(
    'an invariant the model breaks is refuted with a counterexample',
    async () => {
      const result = await verify({
        specPath: join(FIXTURES, 'door-broken.qnt'),
        invariants: ['invNeverOpen'],
        maxSteps: 4,
        outDir: join(OUT, 'broken'),
        timeoutMs: CHECK_TIMEOUT_MS,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.output).toContain('invNeverOpen');
      expect(result.output).toContain('found a counterexample');
      expect(result.output).toContain('[State 1] { state: "open" }');
    },
    CHECK_TIMEOUT_MS
  );

  test.concurrent(
    'a model Apalache cannot encode fails with its reason, not its log',
    async () => {
      const result = await verify({
        specPath: join(FIXTURES, 'door-unbounded.qnt'),
        invariants: ['invCountsFromOne'],
        maxSteps: 2,
        outDir: join(OUT, 'unbounded'),
        timeoutMs: CHECK_TIMEOUT_MS,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.output).toContain('Expected a constant integer');
      expect(result.output).not.toMatch(/ I@\d/);
    },
    CHECK_TIMEOUT_MS
  );

  test('a model with no invariant fails without running the checker', async () => {
    const result = await verify({
      specPath: join(FIXTURES, 'door.qnt'),
      invariants: [],
      maxSteps: 4,
      outDir: join(OUT, 'none'),
      timeoutMs: CHECK_TIMEOUT_MS,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.output).toContain('proves nothing');
  });

  test.concurrent(
    'induction rejects an invalid initial state even when every successor is safe',
    async () => {
      // regression: quint-induction-redundant-state-zero
      const result = await verify({
        specPath: join(FIXTURES, 'door-induction-initial.qnt'),
        invariants: ['invNeverOpen'],
        inductiveInvariant: 'invNeverOpen',
        separateInduction: true,
        maxSteps: 4,
        outDir: join(OUT, 'invalid-initial-induction'),
        timeoutMs: CHECK_TIMEOUT_MS,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.output).toContain('; initial)');
      expect(result.output).toContain('found a counterexample');
      expect(result.output).toContain('[State 0] { state: "open" }');
    },
    CHECK_TIMEOUT_MS
  );

  test.concurrent(
    'separate induction checks a later guarded choice and its enclosing draws',
    async () => {
      // regression: quint-induction-redundant-state-zero
      const result = await verify({
        specPath: join(FIXTURES, 'door-induction-choices.qnt'),
        invariants: ['invNeverOpen'],
        inductiveInvariant: 'invNeverOpen',
        separateInduction: true,
        maxSteps: 4,
        outDir: join(OUT, 'invalid-later-induction-choice'),
        timeoutMs: CHECK_TIMEOUT_MS,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.output).toContain('found a counterexample');
      expect(result.output).toContain('[State 1] { state: "open" }');
    },
    CHECK_TIMEOUT_MS
  );

  test.concurrent.each(['invKnownState', 'invNeverOpen'])(
    'separate induction retains the safety implication for %s',
    async (invariant) => {
      // regression: quint-induction-redundant-state-zero
      const result = await verify({
        specPath: join(FIXTURES, 'door-induction-choices.qnt'),
        invariants: [invariant],
        inductiveInvariant: 'invKnownState',
        separateInduction: true,
        maxSteps: 4,
        outDir: join(OUT, `separate-implication-${invariant}`),
        timeoutMs: CHECK_TIMEOUT_MS,
      });
      expect(result.ok).toBe(invariant === 'invKnownState');
      if (!result.ok) expect(result.output).toContain('; implication)');
    },
    CHECK_TIMEOUT_MS
  );

  test.concurrent(
    'an inductive candidate must survive every transition, even when ordinary safety holds',
    async () => {
      // regression: quint-inductive-candidate-unchecked
      const result = await verify({
        specPath: join(FIXTURES, 'door-induction.qnt'),
        invariants: ['invKnownState'],
        inductiveInvariant: '_notInductive',
        maxSteps: 4,
        outDir: join(OUT, 'false-induction'),
        timeoutMs: CHECK_TIMEOUT_MS,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.output).toContain('_notInductive');
    },
    CHECK_TIMEOUT_MS
  );

  test.concurrent(
    'a preserved candidate must imply the requested safety property',
    async () => {
      // regression: quint-inductive-candidate-unchecked
      const result = await verify({
        specPath: join(FIXTURES, 'door-induction.qnt'),
        invariants: ['invNeverOpen'],
        inductiveInvariant: '_inductive',
        maxSteps: 4,
        outDir: join(OUT, 'false-implication'),
        timeoutMs: CHECK_TIMEOUT_MS,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.output).toContain('invNeverOpen');
    },
    CHECK_TIMEOUT_MS
  );

  test.concurrent(
    'a safety target checked as the candidate still rejects its failing transition',
    async () => {
      // regression: quint-induction-expanded-transitions
      const outDir = join(OUT, 'covered-broken-induction');
      const result = await verify({
        specPath: join(FIXTURES, 'door-broken.qnt'),
        invariants: ['invNeverOpen'],
        inductiveInvariant: 'invNeverOpen',
        maxSteps: 4,
        outDir,
        timeoutMs: CHECK_TIMEOUT_MS,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.output).toContain('invNeverOpen');
      expect(
        JSON.parse(readFileSync(join(outDir, 'apalache-config.json'), 'utf8'))
      ).toEqual({
        checker: { tuning: { 'search.invariant.mode': 'before' } },
      });
    },
    CHECK_TIMEOUT_MS
  );

  test.concurrent(
    'a preserved candidate proves the requested invariants by induction',
    async () => {
      const result = await verify({
        specPath: join(FIXTURES, 'door-induction.qnt'),
        invariants: ['invKnownState'],
        inductiveInvariant: '_inductive',
        maxSteps: 4,
        outDir: join(OUT, 'induction'),
        timeoutMs: CHECK_TIMEOUT_MS,
      });
      expect(result).toMatchObject({ ok: true });
    },
    CHECK_TIMEOUT_MS
  );
});

describe('the pinned Apalache', () => {
  test('is the release the pinned Quint expects, so Quint never fetches its own', () => {
    const quintApalache = readFileSync(
      Bun.resolveSync(
        '@informalsystems/quint/dist/src/apalache.js',
        import.meta.dir
      ),
      'utf8'
    );
    expect(quintApalache).toContain(
      `DEFAULT_APALACHE_VERSION_TAG = '${APALACHE_VERSION}'`
    );
  });

  test('a missing install says how to get it', () => {
    const missing = resolveApalache({ APALACHE_HOME: join(OUT, 'no-such') });
    expect(missing).toEqual({
      error: expect.stringContaining('mise install'),
    });
  });

  test('APALACHE_HOME, when set, is where it is looked for', () => {
    const pinned = resolveApalache({});
    expect('home' in pinned).toBe(true);
    if (!('home' in pinned)) return;
    expect(resolveApalache({ APALACHE_HOME: pinned.home })).toEqual(pinned);
  });
});
