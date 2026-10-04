/**
 * The schema-safety model, replayed against the evolution gate. Apalache
 * checks every interleaving; each drawn trace must agree with `assertEvolvable`.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runQuintModel } from '@pkgs/quint-server/bun-test';
import { modelInvariants } from '@pkgs/quint-server/simulate';
import { verify } from '@pkgs/quint-server/verify';

import './db-schema';

const SPEC = join(import.meta.dir, 'schema-safety.qnt');
const SPEC_URI = 'pkgs/db-schema-harness/tests/quint/schema-safety.qnt';
const REPORT = join(import.meta.dir, '../../.cache/schema-safety');

runQuintModel({
  packageName: '@pkgs/db-schema',
  specPath: SPEC,
  specUri: SPEC_URI,
  reportDir: REPORT,
});

const VERIFY_TIMEOUT_MS = 180_000;

describe('schema safety, every interleaving', () => {
  test(
    'no dangerous change, no lost or rewritten value, and tombstones stay',
    async () => {
      const invariants = modelInvariants(readFileSync(SPEC, 'utf8'));
      const result = await verify({
        specPath: SPEC,
        invariants,
        maxSteps: 6,
        outDir: join(REPORT, 'apalache'),
        timeoutMs: VERIFY_TIMEOUT_MS,
      });
      expect(result).toMatchObject({ ok: true });
    },
    VERIFY_TIMEOUT_MS
  );
});
