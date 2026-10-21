import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { verify } from '@pkgs/quint-server-ts/verify';

// regression: quint-verifier-default-stack-exhaustion
test('a door with forty-two typed calibration values can be verified', async () => {
  const result = await verify({
    specPath: join(import.meta.dir, 'fixtures/door-many-values.qnt'),
    invariants: ['invKnownState'],
    maxSteps: 1,
    outDir: join(import.meta.dir, '../.cache/test-verify-depth'),
    timeoutMs: 120_000,
    inferPolymorphicTypes: false,
  });
  expect(result).toMatchObject({ ok: true });
}, 120_000);
