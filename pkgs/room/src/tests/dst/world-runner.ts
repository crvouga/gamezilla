import fc from 'fast-check';

import type { RoomDstApp } from '../../sim/dst/app';
import type { RoomWorldKnobs } from '../../sim/dst/knobs';
import { arbWorldKnobs, arbWorldSeed } from '../../sim/dst/knobs';
import type { WorldCmd } from '../../sim/dst/run-commands';

import { worldCommands } from './commands';

export type { WorldKnobs } from './world-config';

export function worldPropertyInputs(
  app: RoomDstApp,
  maxCommands = 14
): fc.Arbitrary<[number, RoomWorldKnobs, Iterable<WorldCmd>]> {
  return fc.tuple(arbWorldSeed(), arbWorldKnobs()).chain(([seed, knobs]) => {
    const ids = Array.from({ length: knobs.clientCount }, (_, i) => `c${i}`);
    return fc.tuple(
      fc.constant(seed),
      fc.constant(knobs),
      worldCommands(app, ids, maxCommands)
    );
  });
}
