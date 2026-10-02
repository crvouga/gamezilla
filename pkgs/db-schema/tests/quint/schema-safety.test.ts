/**
 * The schema-safety model, replayed against the evolution gate. Apalache
 * checks every interleaving; each drawn trace must agree with `assertEvolvable`.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runQuintModel } from '@pkgs/quint/bun-test';
import { bindQuintModel, setQuintWorld } from '@pkgs/quint/registry';
import { modelInvariants } from '@pkgs/quint/simulate';
import { verify } from '@pkgs/quint/verify';

import {
  addDetail,
  cellsMap,
  columnPick,
  copyDetail,
  createSafetyWorld,
  dropRefused,
  fillBlank,
  forgetRefused,
  renameRefused,
  resetSafetyWorld,
  retireDetail,
  retypeRefused,
  retypeTombstoneRefused,
  type SafetyWorld,
  typePick,
} from './schema-safety-world';

const SPEC = join(
  import.meta.dir,
  '../../../../specs/db-schema/schema-safety.qnt'
);
const SPEC_URI = 'specs/db-schema/schema-safety.qnt';
const REPORT = join(import.meta.dir, '../../.cache/schema-safety');

setQuintWorld<SafetyWorld>({
  create: async () => createSafetyWorld(),
  dispose: async () => {},
});

bindQuintModel<SafetyWorld>({
  model: 'schema-safety',
  traces: 80,
  maxSteps: 12,
  verifySteps: 6,
  actions: {
    init: async (world) => {
      resetSafetyWorld(world);
    },
    addColumn: async (world, picks) => {
      addDetail(world, columnPick(picks, 'col'), typePick(picks, 'typ'));
    },
    retireColumn: async (world, picks) => {
      retireDetail(world, columnPick(picks, 'col'));
    },
    backfill: async (world, picks) => {
      fillBlank(world, columnPick(picks, 'col'));
    },
    copyIntoNew: async (world, picks) => {
      copyDetail(world, columnPick(picks, 'col'), columnPick(picks, 'other'));
    },
    retype: async (world, picks) => {
      retypeRefused(world, columnPick(picks, 'col'));
    },
    dropColumn: async (world, picks) => {
      dropRefused(world, columnPick(picks, 'col'));
    },
    forgetTombstone: async (world, picks) => {
      forgetRefused(world, columnPick(picks, 'col'));
    },
    changeFrozenType: async (world, picks) => {
      retypeTombstoneRefused(world, columnPick(picks, 'col'));
    },
    renameInPlace: async (world, picks) => {
      renameRefused(world, columnPick(picks, 'col'));
    },
    goOffline: async (world) => {
      world.online = false;
    },
    goOnline: async (world) => {
      world.online = true;
    },
  },
  observe: async (world) => ({
    shared: cellsMap(world.shared),
    device: cellsMap(world.device),
    online: world.online,
  }),
  fingerprint: async (world) =>
    JSON.stringify({
      online: world.online,
      shared: world.shared,
      device: world.device,
    }),
});

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
