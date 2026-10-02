import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { modelInvariants } from '@pkgs/quint/simulate';
import { verify } from '@pkgs/quint/verify';

// regression: model-array-encoding-default
test('the default solver supports the outside-accounts model', async () => {
  const specPath = join(
    import.meta.dir,
    '../../../specs/auth/outside-accounts.qnt'
  );
  const result = await verify({
    specPath,
    invariants: modelInvariants(readFileSync(specPath, 'utf8')),
    maxSteps: 1,
    outDir: join(import.meta.dir, '../.cache/default-model-encoding'),
    timeoutMs: 120_000,
  });
  expect(result).toMatchObject({ ok: true });
}, 120_000);
