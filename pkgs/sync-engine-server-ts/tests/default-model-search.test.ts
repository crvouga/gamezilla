import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { modelInvariants } from '@pkgs/quint-server-ts/simulate';
import { verify } from '@pkgs/quint-server-ts/verify';

// regression: sync-model-invariant-query-timeout
test('the note replication model proves every invariant at its declared bound', async () => {
  const specPath = join(
    import.meta.dir,
    '../../../specs/sync-engine/note-replication.qnt'
  );
  const result = await verify({
    specPath,
    invariants: modelInvariants(readFileSync(specPath, 'utf8')),
    maxSteps: 1,
    outDir: join(import.meta.dir, '../.cache/default-model-search'),
    timeoutMs: 240_000,
  });
  expect(result).toMatchObject({ ok: true });
}, 240_000);
