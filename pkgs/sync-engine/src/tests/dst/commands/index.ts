import fc from 'fast-check';

import type { DstApp } from '../../../sim/dst/app';
import {
  arbWorldKnobs,
  arbWorldSeed,
  type WorldKnobs,
} from '../../../sim/dst/knobs';
import {
  initialWorldState,
  type WorldCmd,
} from '../../../sim/dst/run-commands';
import {
  AUTH_STATUSES,
  applyActionToModel,
  CLIENT_IDS,
  CORRUPTION_VARIANTS,
  CRASH_EVENTS,
  clientLive,
  HOLD_TRAFFIC,
  HTTP_FAULTS,
  initialWorldModel,
  modelAllowsAction,
  PUBSUB_FAULTS,
  SCHEMA_VARIANTS,
  SKEW_MS_VALUES,
  STORAGE_PRESSURES,
  STORAGE_TAMPERS,
  type WorldModel,
  type WorldReal,
} from '../../../sim/dst/world-model';
import { buildWorldCommandPool } from './command-arbs';

export type { WorldCmd };

/** Weighted command generator for shrinking DST over World. */
export function worldCommands(
  app: DstApp,
  clientIds: readonly string[],
  maxCommands = 14
): fc.Arbitrary<Iterable<WorldCmd>> {
  return fc.commands(buildWorldCommandPool(app, clientIds), {
    maxCommands,
    size: 'small',
  });
}

export { initialWorldState };

export function worldPropertyInputs(
  app: DstApp,
  maxCommands = 14
): fc.Arbitrary<[number, WorldKnobs, Iterable<WorldCmd>]> {
  return fc.tuple(arbWorldSeed(), arbWorldKnobs()).chain(([seed, knobs]) => {
    const ids = Array.from({ length: knobs.clientCount }, (_, i) => `c${i}`);
    return fc.tuple(
      fc.constant(seed),
      fc.constant(knobs),
      worldCommands(app, ids, maxCommands)
    );
  });
}

export type { WorldModel, WorldReal };
export {
  AUTH_STATUSES,
  applyActionToModel,
  CLIENT_IDS,
  CORRUPTION_VARIANTS,
  CRASH_EVENTS,
  clientLive,
  HOLD_TRAFFIC,
  HTTP_FAULTS,
  initialWorldModel,
  modelAllowsAction,
  PUBSUB_FAULTS,
  SCHEMA_VARIANTS,
  SKEW_MS_VALUES,
  STORAGE_PRESSURES,
  STORAGE_TAMPERS,
};
