import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { verifyTemporal } from '@pkgs/quint-server/temporal';
import { verify } from '@pkgs/quint-server/verify';

const FIXTURE = join(import.meta.dir, 'fixtures/parameterized-door.qnt');
const OUT = join(import.meta.dir, '../.cache/parameterized-proof');
const TIMEOUT_MS = 120_000;

test(
  'bounded verification checks both constant assignments',
  async () => {
    const result = await verify({
      specPath: FIXTURE,
      invariants: ['invKnownState'],
      maxSteps: 2,
      outDir: join(OUT, 'safe'),
      timeoutMs: TIMEOUT_MS,
    });
    expect(result.ok).toBe(true);
    for (const value of [false, true])
      expect(
        existsSync(join(OUT, `safe/LOCKED=${String(value)}/_apalache-out`))
      ).toBe(true);
  },
  TIMEOUT_MS
);

test(
  'a counterexample in the second assignment refutes the whole bounded proof',
  async () => {
    const result = await verify({
      specPath: FIXTURE,
      invariants: ['candidateUnlockedMode'],
      maxSteps: 2,
      outDir: join(OUT, 'unsafe'),
      timeoutMs: TIMEOUT_MS,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.output).toContain('LOCKED=true');
    expect(result.output).toContain('found a counterexample');
  },
  TIMEOUT_MS
);

test(
  'temporal verification completes both finite graphs',
  async () => {
    const result = await verifyTemporal({
      specPath: FIXTURE,
      properties: ['liveUnlocked'],
      invariants: ['invKnownState'],
      outDir: join(OUT, 'live'),
      timeoutMs: TIMEOUT_MS,
    });
    expect(result).toMatchObject({ ok: true, statesExplored: 8 });
    for (const value of [false, true])
      expect(
        existsSync(join(OUT, `live/LOCKED=${String(value)}/tlc-output.txt`))
      ).toBe(true);
  },
  TIMEOUT_MS
);

test(
  'a temporal counterexample in the second assignment refutes the whole proof',
  async () => {
    const result = await verifyTemporal({
      specPath: FIXTURE,
      properties: ['liveUnlockedMode'],
      outDir: join(OUT, 'not-live'),
      timeoutMs: TIMEOUT_MS,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.output).toContain('LOCKED=true');
    expect(result.output).toContain('counter-example');
  },
  TIMEOUT_MS
);
