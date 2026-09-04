import type { System } from '@pkgs/dst';

import type { SyncAction, SyncArgs, SyncSurface } from '../../../sim/scenario';
import { playActions } from '../../../sim/scenario';
import { expectConverged } from './expect-converged';
import { acmeSystem } from './system';

export type PlayAcmePinOpts = {
  readonly seed: number | bigint | string;
  readonly args?: Partial<SyncArgs>;
  readonly actions: readonly SyncAction[];
  /**
   * When true (default), revive + wait for domain agreement after the script.
   * Set false when the pin asserts mid-fault / pre-heal state.
   */
  readonly converge?: boolean;
  /** Defaults to {@link acmeSystem}. */
  readonly system?: System<SyncSurface, SyncArgs>;
};

/**
 * Boot acme and play a scripted chaos sequence. By default heals and waits for
 * domain agreement via {@link expectConverged}.
 */
export async function playAcmePin(opts: PlayAcmePinOpts): Promise<void> {
  const system = opts.system ?? acmeSystem;
  await using s = await system.script({
    seed: opts.seed,
    ...(opts.args !== undefined ? { args: opts.args } : {}),
  });
  await s.apply(playActions, opts.actions);
  if (opts.converge !== false) await expectConverged(s);
}
