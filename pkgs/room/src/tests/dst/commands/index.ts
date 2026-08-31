import fc from 'fast-check';

import type { RoomDstApp } from '../../../sim/dst/app';
import {
  initialWorldState,
  type WorldCmd,
} from '../../../sim/dst/run-commands';
import {
  applyActionToModel,
  BYZANTINE_INJECT_KINDS,
  buildByzantineRaw,
  CLIENT_IDS,
  clientLive,
  initialWorldModel,
  modelAllowsAction,
  NET_FAULT_PROFILES,
  WORLD_PBT_CRASH_EVENTS,
  type WorldModel,
  type WorldReal,
} from '../../../sim/dst/world-model';

import { buildWorldCommandPool } from './command-arbs';

/** Weighted command generator for shrinking DST over World. */
export function worldCommands(
  app: RoomDstApp,
  clientIds: readonly string[],
  maxCommands = 14
): fc.Arbitrary<Iterable<WorldCmd>> {
  return fc.commands(buildWorldCommandPool(app, clientIds), {
    maxCommands,
    size: 'small',
  });
}

export type { WorldCmd, WorldModel, WorldReal };
export {
  applyActionToModel,
  BYZANTINE_INJECT_KINDS,
  buildByzantineRaw,
  CLIENT_IDS,
  clientLive,
  initialWorldModel,
  initialWorldState,
  modelAllowsAction,
  NET_FAULT_PROFILES,
  WORLD_PBT_CRASH_EVENTS,
};
