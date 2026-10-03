import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { modelTemporalProperties, verifyTemporal } from '@pkgs/quint/temporal';

const FIXTURES = join(import.meta.dir, 'fixtures');
const OUT = join(import.meta.dir, '../.cache/test-temporal');
const TIMEOUT_MS = 120_000;

test('only declared public temporal properties become release obligations', () => {
  expect(
    modelTemporalProperties(`module sample {
  // temporal fake = false
  /*
  temporal alsoFake = false
  */
  temporal _fair = true
  temporal liveSaved = _fair.implies(eventually(done))
  temporal liveVisible = eventually(visible)
}`)
  ).toEqual(['liveSaved', 'liveVisible']);
});

test(
  'concurrent temporal checks own independent checker servers',
  async () => {
    // regression: quint-temporal-shared-port
    // regression: check-tlc-shared-temporary-modules
    const results = await Promise.all(
      ['first', 'second'].map((name) =>
        verifyTemporal({
          specPath: join(FIXTURES, 'progress.qnt'),
          properties: ['liveCompletion'],
          outDir: join(OUT, `concurrent-${name}`),
          timeoutMs: TIMEOUT_MS,
        })
      )
    );
    for (const result of results) {
      expect(result).toMatchObject({ ok: true });
      if (result.ok) expect(result.statesExplored).toBeGreaterThan(0);
    }
    for (const name of ['first', 'second']) {
      const directory = join(OUT, `concurrent-${name}`);
      // Literal failing input: two progress.qnt parsers read an incomplete
      // shared /tmp/Integers.tla. Each standard module must now be private.
      expect(readFileSync(join(directory, 'tlc-output.txt'), 'utf8')).toContain(
        join(directory, 'tmp/Integers.tla')
      );
    }
  },
  TIMEOUT_MS
);

test(
  'fair completion holds across the entire finite state graph',
  async () => {
    const result = await verifyTemporal({
      specPath: join(FIXTURES, 'progress.qnt'),
      properties: ['liveCompletion'],
      outDir: join(OUT, 'progress'),
      timeoutMs: TIMEOUT_MS,
    });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.statesExplored).toBeGreaterThan(0);
  },
  TIMEOUT_MS
);

test(
  'fair completion cannot conceal a safety violation in the same graph',
  async () => {
    const result = await verifyTemporal({
      specPath: join(FIXTURES, 'progress.qnt'),
      properties: ['liveCompletion'],
      invariants: ['invNeverFinishes'],
      outDir: join(OUT, 'unsafe-progress'),
      timeoutMs: TIMEOUT_MS,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.output).toContain('invNeverFinishes');
  },
  TIMEOUT_MS
);

test(
  'safe states cannot hide permanently unreachable completion',
  async () => {
    // regression: quint-temporal-obligations-unchecked
    const result = await verifyTemporal({
      specPath: join(FIXTURES, 'progress-stuck.qnt'),
      properties: ['liveCompletion'],
      outDir: join(OUT, 'stuck'),
      timeoutMs: TIMEOUT_MS,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.output).toContain('liveCompletion');
      expect(result.output).toContain('counter-example');
    }
  },
  TIMEOUT_MS
);

test('a temporal check without a property fails before starting TLC', async () => {
  const result = await verifyTemporal({
    specPath: join(FIXTURES, 'progress.qnt'),
    properties: [],
    outDir: join(OUT, 'none'),
    timeoutMs: TIMEOUT_MS,
  });
  expect(result).toMatchObject({ ok: false });
  if (!result.ok) expect(result.output).toContain('no temporal property');
});
