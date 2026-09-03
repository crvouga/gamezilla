import { start } from '@pkgs/dst';

import type { SyncAction } from '../../../sim/scenario';
import {
  converge,
  playActions,
  type SyncKnobs,
  type SyncSystemDef,
  syncVirtualHost,
} from '../../../sim/scenario';
import { acmeDraws, acmeSystem } from './system';

export type PlayAcmePinOpts = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<SyncKnobs>;
  readonly actions: readonly SyncAction[];
  /** Skip the heal + assert-converged tail (default false). */
  readonly converge?: boolean;
  /** Defaults to {@link acmeSystem}. */
  readonly system?: SyncSystemDef;
};

/**
 * Boot acme, play a scripted chaos sequence, then heal and assert every client
 * agrees with the server. Shrunk PBT counterexamples land here as pins.
 */
export async function playAcmePin(opts: PlayAcmePinOpts): Promise<void> {
  await using run = await start(opts.system ?? acmeSystem, {
    seed: opts.seed,
    host: syncVirtualHost(),
    draws: acmeDraws(opts.knobs),
    properties: [],
  });
  await run.apply(playActions, opts.actions);
  if (opts.converge !== false) await run.apply(converge);
}
