/**
 * Curated deterministic-sim surface for product acceptance worlds
 * (`@libs/sim`). Prefer this over deep imports into `src/sim/`.
 */

export type { SimClock } from '@pkgs/determinism';
export type { SimClientHandle } from '../sim/client-handle';
export type { SimDomainPack, SimSessionQuery } from '../sim/domain-pack';
export { emptySimPushChannels } from '../sim/domain-pack';
export type { SeededRng } from '../sim/rng';
export type {
  SyncAction,
  SyncApp,
  SyncSystemFacade,
  WorldKnobs,
} from '../sim/system';
export { syncFacade } from '../sim/system';
export type { NeverOpts, UntilOpts, UntilTarget } from '../sim/until';
