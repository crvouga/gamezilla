import { start } from '@pkgs/dst';

import type { SyncAction } from '../../../sim/scenario';
import {
  playActions,
  type SyncKnobs,
  type SyncSystemDef,
  syncVirtualHost,
} from '../../../sim/scenario';
import { expectConverged } from './expect-converged';
import { acmeKnobs, acmeSystem } from './system';

export type PlayAcmePinOpts = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<SyncKnobs>;
  readonly actions: readonly SyncAction[];
  /**
   * When true (default), revive + wait for domain agreement after the script.
   * Set false when the pin asserts mid-fault / pre-heal state.
   */
  readonly converge?: boolean;
  /** Defaults to {@link acmeSystem}. */
  readonly system?: SyncSystemDef;
};

/**
 * Boot acme and play a scripted chaos sequence. By default heals and waits for
 * domain agreement via {@link expectConverged}.
 */
export async function playAcmePin(opts: PlayAcmePinOpts): Promise<void> {
  await using run = await start(opts.system ?? acmeSystem, {
    seed: opts.seed,
    host: syncVirtualHost(),
    knobs: acmeKnobs(opts.knobs),
    properties: [],
  });
  await run.apply(playActions, opts.actions);
  if (opts.converge !== false) await expectConverged(run);
}
