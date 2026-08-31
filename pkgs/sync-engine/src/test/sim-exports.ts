/**
 * Curated deterministic-sim surface for product acceptance worlds
 * (`@libs/sim`). Prefer this over deep imports into `src/sim/`.
 */

export type { SimClientHandle } from '../sim/client-handle';
export type { SimClock } from '../sim/clock';
export type { SimDomainPack, SimSessionQuery } from '../sim/domain-pack';
export { emptySimPushChannels } from '../sim/domain-pack';
export type { DstAction, DstApp, WorldKnobs } from '../sim/dst';
export type { SeededRng } from '../sim/rng';
export type { NeverOpts, UntilOpts, UntilTarget } from '../sim/until';
export { openWorld } from '../sim/world';
export type {
  OpenWorldArgs,
  World,
} from '../sim/world-api';
