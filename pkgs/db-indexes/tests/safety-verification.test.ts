// @io-wall-ok — test entry reads technical models and invokes pinned Apalache.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { modelInvariants } from '@pkgs/quint/simulate';
import { verify } from '@pkgs/quint/verify';

for (const model of ['index-retirement', 'index-interruption']) {
  const steps = model === 'index-retirement' ? 7 : 4;
  test(`${model}: all invariants hold for every behavior within ${steps} steps`, async () => {
    const specPath = join(import.meta.dir, 'contracts', `${model}.qnt`);
    const result = await verify({
      specPath,
      invariants: modelInvariants(readFileSync(specPath, 'utf8')),
      maxSteps: steps,
      outDir: join(import.meta.dir, '../.cache/safety-verify', model),
      timeoutMs: 120_000,
    });
    if (!result.ok) throw new Error(result.output);
    expect(result.ok).toBe(true);
  }, 120_000);
}
