import { bindQuintModel, setQuintWorld } from '@pkgs/quint-shared/registry';

import { addDetail, cellsMap, columnPick, copyDetail, createSafetyWorld, dropRefused, fillBlank, forgetRefused, renameRefused, resetSafetyWorld, retireDetail, retypeRefused, retypeTombstoneRefused, typePick } from './schema-safety-world';
import type { SafetyWorld } from './schema-safety-world';

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
